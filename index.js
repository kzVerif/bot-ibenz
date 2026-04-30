import "dotenv/config"; // Correct ESM way to load dotenv
import {
  REST,
  Routes,
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { walletTopup } from "./wallet/angpoa.js";
import { sendLogWalletEmbed } from "./wallet/msgwallet.js";
import { decodeSlipQRCode } from "./bank/QrReader.js";
import { checkSlipRdcw } from "./bank/rdcw.js";
import { sendLogBankEmbed } from "./bank/msgBank.js";
import { checkAndSaveSlip } from "./bank/isDupe.js";
import { createreplyEmbed } from "./embed/reply.js";

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // ดึง ID เซิร์ฟเวอร์มาจาก .env

// ในส่วนการตั้งค่า commands array (Register Commands)
const commands = [
  {
    name: "qr", // คุณอาจจะเปลี่ยนเป็น "pay" ในภายหลัง
    description: "สร้าง Embed ชำระเงิน PromptPay QR Code",
    options: [
      {
        name: "phone", // พารามิเตอร์ที่ 1: เบอร์โทร/ID
        description: "เบอร์โทรศัพท์พร้อมเพย์ หรือ เลขบัตรประชาชน",
        type: 3, // STRING
        required: true,
      },
      {
        name: "amount", // พารามิเตอร์ที่ 2: ยอดเงิน
        description: "จำนวนเงินที่ต้องการให้ชำระ (เช่น 100.50)",
        type: 10, // NUMBER (รองรับทศนิยม)
        required: true,
      },
    ],
  },
  {
    name: "wallet", // คุณอาจจะเปลี่ยนเป็น "pay" ในภายหลัง
    description: "สร้าง Embed ชำระเงิน TrueMoney Wallet",
  },
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Top-level await is allowed in ESM files
try {
  console.log("Started refreshing application (/) commands.");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("Successfully reloaded application (/) commands.");
} catch (error) {
  console.error(error);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages, // ให้บอทมองเห็นข้อความในเซิร์ฟเวอร์
    GatewayIntentBits.MessageContent, // ให้บอทอ่านเนื้อหาข้อความได้
  ],
});

client.on(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

// Slash Command Handling
client.on(Events.InteractionCreate, async (interaction) => {
  // เช็คว่าเป็น Slash Command หรือไม่
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "qr") {
    const member = interaction.member;
    if (!member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      const embed = await createreplyEmbed(
        "❌",
        "คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้",
        false,
      );
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }
    // 1. ดึงค่า Parameters
    const phone = interaction.options.getString("phone");
    const amount = interaction.options.getNumber("amount");

    const qrCodeUrl = `https://promptpay.io/${phone}/${amount}.png`;

    const formattedAmount = new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    const paymentEmbed = new EmbedBuilder()
      .setColor(0x06c755)
      .setTitle("🩷 Rakjang Store")
      .setDescription(
        [
          "`ชำระเงินด้วย PromptPay QR Code`",
          "",
          "`📱` `:` `แสกน QR Code เพื่อชำระเงิน`",
          "`🔴` `:` `เมื่อชำระเงินแล้วส่งสลิปเข้าห้องได้เลย`",
        ].join("\n"),
      )

      .setImage(qrCodeUrl)
      .setTimestamp()
      .setFooter({
        text: `${client.user.username} • ระบบชำระเงินอัตโนมัติ`,
        iconURL: client.user.displayAvatarURL(),
      });

    // 5. ส่งคำตอบกลับไป (reply)
    await interaction.reply({
      embeds: [paymentEmbed],
    });
  }

  if (interaction.commandName === "wallet") {
    const member = interaction.member;
    if (!member.roles.cache.has("1498389644679577862")) {
      const embed = await createreplyEmbed(
        "❌",
        "คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้",
        false,
      );
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }
    const paymentEmbed = new EmbedBuilder()
      .setColor(0x06c755)
      .setTitle("🩷 Rakjang Store")
      .setDescription(
        [
          "`ชำระเงินด้วย TrueMoney Wallet`",
          "",
          "`🧧` `:` `สร้างซองปั่งเปาแล้วกดปุ่มเพื่อส่งซอง`",
          "`🟢` `:` `คลิ๊กที่ปุ่มเพื่อส่งซอง`",
        ].join("\n"),
      )
      .setTimestamp()
      .setFooter({
        text: `${client.user.username} • ระบบชำระเงินอัตโนมัติ`,
        iconURL: client.user.displayAvatarURL(),
      });

    const sendButton = new ButtonBuilder()
      .setCustomId("send_wallet")
      .setLabel("ส่งซองปั่งเปา")
      .setStyle(ButtonStyle.Success)
      .setEmoji("1455418305702793454");

    const row = new ActionRowBuilder().addComponents(sendButton);

    // 5. ส่งคำตอบกลับไป (reply)
    await interaction.reply({
      embeds: [paymentEmbed],
      components: [row],
    });
  }
});

// Button Interaction Handling
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === "send_wallet") {
    // await interaction.deferReply({ flags: 64 });
    const walletModal = new ModalBuilder()
      .setCustomId("wallet_modal")
      .setTitle("ส่งซองปั่งเปา");

    const url = new TextInputBuilder()
      .setCustomId("wallet_url")
      .setLabel("กรุณาใส่ลิงก์ซองปั่งเปา")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(
        "https://gift.truemoney.com/campaign/voucher_detail?hash=xxxx",
      )
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(url);

    walletModal.addComponents(row1);
    await interaction.showModal(walletModal);
  }

  if (interaction.customId.startsWith("notify_")) {
    const channel = await interaction.guild.channels.cache.get(
      interaction.customId.replace("notify_", ""),
    );
      if (!channel) {
    const embedError = await createreplyEmbed(
      "❌",
      "ห้องนี้ถูกปิดหรือลบไปแล้ว ไม่สามารถแจ้งเตือนได้",
      true,
    );
    await interaction.reply({
      embeds: [embedError],
      flags: 64,
    });
    return;
  }
  
    const embed = await createreplyEmbed(
      "✅",
      "สลิปถูกต้อง ส่งไอดีพร้อมชื่อได้เลยคับ",
      true,
    );
    await channel.send({ embeds: [embed] });
    const embedEphemeral = await createreplyEmbed(
      "✅",
      `แจ้งเตือนผู้ใช้เรียบร้อยแล้ว กลับห้องคลิ้กที่นี่ <#${interaction.customId.replace("notify_", "")}> เพื่อดูรายละเอียดเพิ่มเติม`,
      true,
    );
    await interaction.reply({
      embeds: [embedEphemeral],
      flags: 64,
    });
    return;
  }
});

// Modal Submit Handling
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "wallet_modal") {
    const url = interaction.fields.getTextInputValue("wallet_url");
    const res = await walletTopup(url);
    if (!res.status) {
      const embed = await createreplyEmbed(
        "❌",
        `รับซองไม่สำเร็จ: ${res.reason}`,
        false,
      );
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }
    await sendLogWalletEmbed(client, {
      authorId: interaction.user.id,
      channelId: interaction.channelId,
      channelName: interaction.channel.name,
      authorTag: interaction.user.tag,
      amount: String(res.amount) || "0", // กำหนดเป็นจำนวนเงินสูงๆ เพื่อให้เห็นใน log ว่ามีการรับซองไม่สำเร็จ
      link: interaction.fields.getTextInputValue("wallet_url"),
    });
    const embed = await createreplyEmbed(
      "✅",
      `รับซองสำเร็จ! จำนวนเงินที่ได้รับ: ${res.amount} บาท`,
      true,
    );
    await interaction.reply({ embeds: [embed], flags: 64 });
    return;
  }
});

// ดัก Slip
client.on(Events.MessageCreate, async (message) => {
  // 1. ป้องกันบอทตอบกันเอง
  if (message.author.bot) return;

  // 2. เช็คว่าอยู่ในห้องที่ขึ้นต้นด้วย "ticket" หรือไม่
  if (message.channel.name?.startsWith("ticket")) {
    // 3. เช็คว่ามีการแนบไฟล์มาหรือไม่ (.size > 0)
    if (message.attachments.size > 0) {
      // 4. ตรวจสอบว่าไฟล์ที่ส่งมามีไฟล์ไหนที่เป็นรูปภาพบ้าง
      // เราจะใช้ .some เพื่อดูว่ามีไฟล์ที่มี contentType เป็น image หรือไม่
      const hasImage = message.attachments.some((attachment) =>
        attachment.contentType?.startsWith("image/"),
      );

      if (hasImage) {
        // บอทตรวจเจอรูปภาพ (เช่น สลิปโอนเงิน)
        const attachment = message.attachments.first();
        const response = await fetch(attachment.url);
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: attachment.contentType });
        const payload = await decodeSlipQRCode(blob); // สมมติว่าเราจะอ่าน QR จากรูปแรกที่ส่งมา
        const rdcw = await checkSlipRdcw(payload);
        const slipResult = checkAndSaveSlip(rdcw.data.transRef);
        if (!slipResult.success) {
          // ดำเนินการต่อหากสลิปใหม่
          const embed = await createreplyEmbed("❌", slipResult.message, false);
          await message.reply({ embeds: [embed] });
          return;
        }

        if (rdcw.code > 200) {
          // await message.reply("เช็คสลิปไม่สำเร็จ 🙏");
          return;
        }
        await sendLogBankEmbed(
          client,
          {
            authorId: message.author.id,
            channelId: message.channel.id,
            channelName: message.channel.name,
            authorTag: message.author.tag, // กำหนดเป็นจำนวนเงินสูงๆ เพื่อให้เห็นใน log ว่ามีการรับซองไม่สำเร็จ
            slipUrl: message.attachments.first().url, // ส่ง URL ของรูปสลิปไปด้วยใน log
          },
          rdcw.data,
        );

        const embed = await createreplyEmbed(
          "✅",
          `ได้รับรูปภาพแล้วครับ! กรุณารอแอดมินตรวจสอบสักครู่ 🙏 ไปที่ห้อง <#${process.env.LOG_CHANNEL_ID}> เพื่อดูรายละเอียดเพิ่มเติม`,
          true,
        );
        await message.reply({ embeds: [embed] });
      }
    }

    // Wallet Top-up Link Handling
    // if (
    //   message.content.startsWith(
    //     "https://gift.truemoney.com/campaign/voucher_detail",
    //   )
    // ) {
    //   const res = await walletTopup(message.content);
    //   if (!res.status) {
    //     await message.reply(`รับซองไม่สำเร็จ: ${res.reason}`);
    //     return;
    //   }
    //   await sendLogWalletEmbed(client, {
    //     authorId: message.author.id,
    //     channelId: message.channel.id,
    //     channelName: message.channel.name,
    //     authorTag: message.author.tag,
    //     amount: String(res.amount) || "0", // กำหนดเป็นจำนวนเงินสูงๆ เพื่อให้เห็นใน log ว่ามีการรับซองไม่สำเร็จ
    //     link: message.content,
    //   });
    //   await message.reply(
    //     `รับซองสำเร็จ! จำนวนเงินที่ได้รับ: ${res.amount} บาท`,
    //   );
    // }
  }
});

client.login(TOKEN);

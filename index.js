import "dotenv/config"; // Correct ESM way to load dotenv
import {
  REST,
  Routes,
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { walletTopup } from "./wallet/angpoa.js";
import { sendLogWalletEmbed } from "./wallet/msgwallet.js";
import { decodeSlipQRCode } from "./bank/QrReader.js";
import { checkSlipRdcw } from "./bank/rdcw.js";
import { sendLogBankEmbed } from "./bank/msgBank.js";

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

client.on(Events.InteractionCreate, async (interaction) => {
  // เช็คว่าเป็น Slash Command หรือไม่
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "qr") {
    const member = interaction.member;
    if (!member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      await interaction.reply({
        content: "คุณไม่มีสิทธิ์ในการใช้คำสั่งนี้",
        ephemeral: true,
      });
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
});

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
          await message.reply(slipResult.message);
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

        await message.reply(
          "ได้รับรูปภาพแล้วครับ! กรุณารอแอดมินตรวจสอบสักครู่ 🙏",
        );
      }
    }

    // Wallet Top-up Link Handling
    if (
      message.content.startsWith(
        "https://gift.truemoney.com/campaign/voucher_detail",
      )
    ) {
      const res = await walletTopup(message.content);
      if (!res.status) {
        await message.reply(`รับซองไม่สำเร็จ: ${res.reason}`);
        return;
      }
      await sendLogWalletEmbed(client, {
        authorId: message.author.id,
        channelId: message.channel.id,
        channelName: message.channel.name,
        authorTag: message.author.tag,
        amount: String(res.amount) || "0", // กำหนดเป็นจำนวนเงินสูงๆ เพื่อให้เห็นใน log ว่ามีการรับซองไม่สำเร็จ
        link: message.content,
      });
      await message.reply(
        `รับซองสำเร็จ! จำนวนเงินที่ได้รับ: ${res.amount} บาท`,
      );
    }
  }
});

client.login(TOKEN);

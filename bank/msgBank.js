import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from "discord.js";

const CHANNEL_ID = process.env.LOG_CHANNEL_ID;

export async function sendLogBankEmbed(client, messageData, slipData) {
  const channel = client.channels.cache.get(CHANNEL_ID);

  if (!channel) {
    return console.error(
      "หาห้องไม่เจอ! ตรวจสอบ ID หรือดูว่าบอทอยู่ในเซิร์ฟเวอร์นั้นไหม",
    );
  }

  const logEmbed = new EmbedBuilder()
    .setColor(0x06c755)
    .setTitle("✅ สลิปผ่านการตรวจสอบ")
    .setDescription(
      [
        `> พบการส่งสลิปจาก <@${messageData.authorId}> ในห้อง <#${messageData.channelId}>`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ].join("\n"),
    )
    .addFields(
      {
        name: "📤 ผู้โอน",
        value: `\`\`\`${slipData.sender.name}\`\`\`**${slipData.sender.displayName}**`,
      },
      {
        name: "📥 ผู้รับ",
        value: `\`\`\`${slipData.receiver.name}\`\`\`**${slipData.receiver.displayName}**`,
      },
      {
        name: "💰 ยอดโอน",
        value: ` \`\`\`฿ ${Number(slipData.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} \`\`\``,
      },
      {
        name: "📱 เบอร์ผู้รับ หรือ บัญชี",
        value: `\`${slipData.receiver.proxy?.value || slipData.receiver.account?.value || "-"} (${slipData.receiver.account?.type || "-"})\``,
      },
      {
        name: "🔖 เลขอ้างอิง",
        value: `\`${slipData.transRef}\``,
        inline: false,
      },
      {
        name: "🕐 เวลาโอน",
        value: `\`${new Date(`${slipData.transDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}T${slipData.transTime}+07:00`).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\``,
        inline: true,
      },
      {
        name: "👤 Discord",
        value: `<@${messageData.authorId}>`,
        inline: true,
      },
    )
    .setImage(messageData.slipUrl)
    .setTimestamp()
    .setFooter({
      text: `RakJang Store Log System • สลิปโอนเงิน`,
      iconURL: client.user.displayAvatarURL(),
    });

  const button = new ButtonBuilder()
    .setCustomId(`notify_${messageData.channelId}`)
    .setLabel("แจ้งเตือนผู้ใช้")
    .setStyle(ButtonStyle.Success)
    .setEmoji("1455418305702793454");

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({ embeds: [logEmbed], components: [row] });
}

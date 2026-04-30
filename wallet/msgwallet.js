import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from "discord.js";

const CHANNEL_ID = process.env.LOG_CHANNEL_ID;

export async function sendLogWalletEmbed(client, messageData) {
  const channel = client.channels.cache.get(CHANNEL_ID);

  if (!channel) {
    return console.error("หาห้องไม่เจอ! ตรวจสอบ ID หรือดูว่าบอทอยู่ในเซิร์ฟเวอร์นั้นไหม");
  }

  const logEmbed = new EmbedBuilder()
    .setColor(0xff6b00)
    .setTitle("🧧 รับเงินอั่งเปาสำเร็จ!")
    .setDescription(
      [
        `> พบการส่งอั่งเปาจาก <@${messageData.authorId}> ในห้อง <#${messageData.channelId}>`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          ` \`👤\` \`:\` <@${messageData.authorId}>`,
          ` \`💰\` \`:\` \`${messageData.amount} บาท\` `,
          ` \`🔗\` \`:\` \`${messageData.link}\` `,
      ].join("\n")
    )
    .setTimestamp()
    .setFooter({
      text: `RakJang Store Log System • อั่งเปา`,
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
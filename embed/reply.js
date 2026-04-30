import {  EmbedBuilder } from "discord.js";

export function createreplyEmbed(emoji, mesaage,success) {
  return new EmbedBuilder()
    .setColor(success ? 0x06c755 : 0xff0000)
    .setTitle(` \`${emoji}\` \`:\` ${mesaage}`)
}
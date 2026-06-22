const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('emojiletters')
    .setDescription("🇹🇺🇷🇳 text into regional indicator emojis")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const out = interaction.options.getString('text').toLowerCase().split('').map((c) => (c >= 'a' && c <= 'z') ? String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 97) + ' ' : c).join(''); await interaction.reply(out.slice(0, 2000)); },
};

const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('syllables')
    .setDescription("Estimate the syllables in a word")
    .addStringOption(op => op.setName('word').setDescription("The word").setRequired(true)),
  execute: async function (interaction) { const w = interaction.options.getString('word').toLowerCase(); const c = (w.match(/[aeiouy]+/g) || []).length - (w.endsWith('e') ? 1 : 0); await interaction.reply(`🗣️ **${interaction.options.getString('word')}** has about **${Math.max(1, c)}** syllable(s).`); },
};

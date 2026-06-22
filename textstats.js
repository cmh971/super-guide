const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('textstats')
    .setDescription("Show stats about your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const t = interaction.options.getString('text'); const words = t.trim().split(/\s+/).filter(Boolean); const sentences = t.split(/[.!?]+/).filter((s) => s.trim()).length; await interaction.reply(`📊 **Chars:** ${t.length} | **Words:** ${words.length} | **Sentences:** ${sentences} | **Avg word len:** ${(words.reduce((a, w) => a + w.length, 0) / (words.length || 1)).toFixed(1)}`); },
};

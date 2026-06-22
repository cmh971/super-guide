const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vowelcount')
    .setDescription("Count the vowels in your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const v = (interaction.options.getString('text').match(/[aeiou]/gi) || []).length; await interaction.reply(`🔤 Your text has **${v}** vowels.`); },
};

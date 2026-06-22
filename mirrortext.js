const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mirrortext')
    .setDescription("Reverse your text backwards")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply([...interaction.options.getString('text')].reverse().join('').slice(0, 2000)); },
};

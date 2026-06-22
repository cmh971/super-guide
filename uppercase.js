const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('uppercase')
    .setDescription("SHOUT your text in all caps")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').toUpperCase().slice(0, 2000)); },
};

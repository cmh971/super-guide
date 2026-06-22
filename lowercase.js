const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lowercase')
    .setDescription("make your text all lowercase")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').toLowerCase().slice(0, 2000)); },
};

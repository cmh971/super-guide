const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('spaceout')
    .setDescription("S p a c e   o u t   your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').split('').join(' ').slice(0, 2000)); },
};

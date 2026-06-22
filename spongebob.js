const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('spongebob')
    .setDescription("mOcK tExT lIkE sPoNgEbOb")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { let i = 0; await interaction.reply(interaction.options.getString('text').replace(/[a-z]/gi, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase())).slice(0, 2000)); },
};

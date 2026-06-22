const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('titlecase')
    .setDescription("Capitalize Each Word")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 2000)); },
};

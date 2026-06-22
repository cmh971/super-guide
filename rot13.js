const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rot13')
    .setDescription("Apply the ROT13 cipher to your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c.charCodeAt(0) + 13) ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)).slice(0, 2000)); },
};

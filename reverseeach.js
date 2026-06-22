const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('reverseeach')
    .setDescription("Reverse the letters in each word")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').split(/\s+/).map((w) => [...w].reverse().join('')).join(' ').slice(0, 2000)); },
};

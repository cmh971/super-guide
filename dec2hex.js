const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dec2hex')
    .setDescription("Convert a decimal number to hex")
    .addIntegerOption(op => op.setName('number').setDescription("Decimal number").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(`💻 \`0x${(interaction.options.getInteger('number') >>> 0).toString(16).toUpperCase()}\``); },
};

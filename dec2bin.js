const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dec2bin')
    .setDescription("Convert a decimal number to binary")
    .addIntegerOption(op => op.setName('number').setDescription("Decimal number").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(`💻 \`${(interaction.options.getInteger('number') >>> 0).toString(2)}\``); },
};

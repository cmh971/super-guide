const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('average')
    .setDescription("Average of space-separated numbers")
    .addStringOption(op => op.setName('numbers').setDescription("e.g. 4 8 15 16").setRequired(true)),
  execute: async function (interaction) { const ns = interaction.options.getString('numbers').trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)); if (!ns.length) return interaction.reply('❌ No valid numbers.'); await interaction.reply(`📊 Average of ${ns.length} numbers = **${(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(2)}**`); },
};

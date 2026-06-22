const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('squareroot')
    .setDescription("Calculate the square root")
    .addNumberOption(op => op.setName('value').setDescription("The number").setRequired(true)),
  execute: async function (interaction) { const v = interaction.options.getNumber('value'); if (v < 0) return interaction.reply('❌ Cannot square-root a negative.'); await interaction.reply(`🧮 √${v} = **${Math.sqrt(v)}**`); },
};

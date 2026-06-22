const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('factorial')
    .setDescription("Calculate n! (factorial)")
    .addIntegerOption(op => op.setName('n').setDescription("0 to 170").setRequired(true)),
  execute: async function (interaction) { const n = interaction.options.getInteger('n'); if (n < 0 || n > 170) return interaction.reply('❌ Enter a number between 0 and 170.'); let r = 1; for (let i = 2; i <= n; i++) r *= i; await interaction.reply(`🧮 ${n}! = **${r}**`); },
};

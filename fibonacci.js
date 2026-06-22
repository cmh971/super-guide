const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fibonacci')
    .setDescription("Get the nth Fibonacci number")
    .addIntegerOption(op => op.setName('n').setDescription("0 to 90").setRequired(true)),
  execute: async function (interaction) { const n = interaction.options.getInteger('n'); if (n < 0 || n > 90) return interaction.reply('❌ Enter 0 to 90.'); let a = 0n; let b = 1n; for (let i = 0; i < n; i++) { [a, b] = [b, a + b]; } await interaction.reply(`🔢 Fibonacci(${n}) = **${a.toString()}**`); },
};

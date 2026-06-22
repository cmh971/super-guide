const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('modulo')
    .setDescription("Remainder of a divided by b")
    .addNumberOption(op => op.setName('a').setDescription("Dividend").setRequired(true))
    .addNumberOption(op => op.setName('b').setDescription("Divisor").setRequired(true)),
  execute: async function (interaction) { const b = interaction.options.getNumber('b'); if (b === 0) return interaction.reply('❌ Cannot divide by zero.'); await interaction.reply(`🧮 ${interaction.options.getNumber('a')} mod ${b} = **${interaction.options.getNumber('a') % b}**`); },
};

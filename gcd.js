const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcd')
    .setDescription("Greatest common divisor of two numbers")
    .addIntegerOption(op => op.setName('a').setDescription("First").setRequired(true))
    .addIntegerOption(op => op.setName('b').setDescription("Second").setRequired(true)),
  execute: async function (interaction) { let a = Math.abs(interaction.options.getInteger('a')); let b = Math.abs(interaction.options.getInteger('b')); while (b) { [a, b] = [b, a % b]; } await interaction.reply(`🧮 GCD = **${a}**`); },
};

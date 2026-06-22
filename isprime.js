const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('isprime')
    .setDescription("Check whether a number is prime")
    .addIntegerOption(op => op.setName('n').setDescription("The number").setRequired(true)),
  execute: async function (interaction) { const n = interaction.options.getInteger('n'); let p = n > 1; for (let i = 2; i <= Math.sqrt(n); i++) { if (n % i === 0) { p = false; break; } } await interaction.reply(`${p ? '✅' : '❌'} **${n}** is ${p ? '' : 'not '}prime.`); },
};

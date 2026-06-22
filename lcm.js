const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lcm')
    .setDescription("Least common multiple of two numbers")
    .addIntegerOption(op => op.setName('a').setDescription("First").setRequired(true))
    .addIntegerOption(op => op.setName('b').setDescription("Second").setRequired(true)),
  execute: async function (interaction) { const x = interaction.options.getInteger('a'); const y = interaction.options.getInteger('b'); let a = Math.abs(x); let b = Math.abs(y); while (b) { [a, b] = [b, a % b]; } await interaction.reply(`🧮 LCM = **${a ? Math.abs(x * y) / a : 0}**`); },
};

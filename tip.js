const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('tip')
    .setDescription("Calculate a tip and total")
    .addNumberOption(op => op.setName('bill').setDescription("Bill amount").setRequired(true))
    .addNumberOption(op => op.setName('percent').setDescription("Tip %").setRequired(true)),
  execute: async function (interaction) { const b = interaction.options.getNumber('bill'); const p = interaction.options.getNumber('percent'); const t = b * p / 100; await interaction.reply(`💵 Tip: **$${t.toFixed(2)}** | Total: **$${(b + t).toFixed(2)}**`); },
};

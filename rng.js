const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rng')
    .setDescription("Random number in a range")
    .addIntegerOption(op => op.setName('min').setDescription("Minimum").setRequired(true))
    .addIntegerOption(op => op.setName('max').setDescription("Maximum").setRequired(true)),
  execute: async function (interaction) { const a = interaction.options.getInteger('min'); const b = interaction.options.getInteger('max'); const lo = Math.min(a, b); const hi = Math.max(a, b); await interaction.reply(`🎲 **${Math.floor(Math.random() * (hi - lo + 1)) + lo}**`); },
};

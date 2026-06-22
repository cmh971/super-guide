const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('flipcoins')
    .setDescription("Flip several coins at once")
    .addIntegerOption(op => op.setName('count').setDescription("How many (1-100)").setRequired(true)),
  execute: async function (interaction) { const n = Math.min(100, Math.max(1, interaction.options.getInteger('count'))); let h = 0; for (let i = 0; i < n; i++) if (Math.random() < 0.5) h++; await interaction.reply(`🪙 ${n} flips → **${h}** heads, **${n - h}** tails.`); },
};

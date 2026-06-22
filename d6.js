const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('d6')
    .setDescription("Roll a 6-sided die"),
  execute: async function (interaction) { await interaction.reply(`🎲 You rolled a **${Math.floor(Math.random() * 6) + 1}**`); },
};

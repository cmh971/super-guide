const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('d20')
    .setDescription("Roll a 20-sided die"),
  execute: async function (interaction) { const r = Math.floor(Math.random() * 20) + 1; await interaction.reply(`🎲 You rolled a **${r}**${r === 20 ? ' — NAT 20! 🎉' : r === 1 ? ' — critical fail 💀' : ''}`); },
};

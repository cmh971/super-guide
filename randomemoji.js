const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomemoji')
    .setDescription("Get a random emoji"),
  execute: async function (interaction) { const e = ['😀', '🎉', '🚀', '🦄', '🍕', '🐸', '🔥', '💎', '🌈', '👾', '🍩', '🦖', '⚡', '🎲', '🪐', '🥑']; await interaction.reply(e[Math.floor(Math.random() * e.length)]); },
};

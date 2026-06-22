const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomhex')
    .setDescription("Generate a random hex color"),
  execute: async function (interaction) { const h = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase(); const { EmbedBuilder } = require('discord.js'); await interaction.reply({ embeds: [new EmbedBuilder().setTitle(h).setColor(h).setDescription('Your random color')] }); },
};

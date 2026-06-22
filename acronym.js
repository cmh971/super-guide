const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('acronym')
    .setDescription("Build an acronym from the first letters")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply('🔠 ' + interaction.options.getString('text').split(/\s+/).map((w) => (w[0] || '').toUpperCase()).join('')); },
};

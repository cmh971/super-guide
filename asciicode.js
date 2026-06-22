const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('asciicode')
    .setDescription("Show the ASCII codes of your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply('```' + [...interaction.options.getString('text')].map((c) => c.charCodeAt(0)).join(' ').slice(0, 1990) + '```'); },
};

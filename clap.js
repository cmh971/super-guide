const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('clap')
    .setDescription("Put 👏 clap 👏 emojis 👏 between words")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').trim().split(/\s+/).join(' 👏 ').slice(0, 2000)); },
};

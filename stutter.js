const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('stutter')
    .setDescription("A-add a st-stutter to your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('text').split(/\s+/).map((w) => (w[0] ? `${w[0]}-${w}` : w)).join(' ').slice(0, 2000)); },
};

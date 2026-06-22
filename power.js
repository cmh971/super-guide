const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('power')
    .setDescription("Raise a base to an exponent")
    .addNumberOption(op => op.setName('base').setDescription("The base").setRequired(true))
    .addNumberOption(op => op.setName('exponent').setDescription("The exponent").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(`🧮 ${interaction.options.getNumber('base')} ^ ${interaction.options.getNumber('exponent')} = **${Math.pow(interaction.options.getNumber('base'), interaction.options.getNumber('exponent'))}**`); },
};

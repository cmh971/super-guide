const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('piglatin')
    .setDescription("Translate-ay to pig latin")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const pig = (w) => { const m = w.match(/^([^aeiou]+)(.*)$/i); return m && m[2] ? m[2] + m[1] + 'ay' : w + 'way'; }; await interaction.reply(interaction.options.getString('text').split(/\s+/).map(pig).join(' ').slice(0, 2000)); },
};

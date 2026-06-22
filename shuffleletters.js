const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffleletters')
    .setDescription("Shuffle the letters in each word")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const sh = (w) => { const a = [...w]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(''); }; await interaction.reply(interaction.options.getString('text').split(/\s+/).map(sh).join(' ').slice(0, 2000)); },
};

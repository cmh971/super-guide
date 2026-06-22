const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('owoify')
    .setDescription("Convert text to owo speak uwu")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { let t = interaction.options.getString('text').replace(/[rl]/g, 'w').replace(/[RL]/g, 'W').replace(/n([aeiou])/g, 'ny$1'); const faces = [' uwu', ' owo', ' >w<', ' ^w^']; await interaction.reply((t + faces[Math.floor(Math.random() * faces.length)]).slice(0, 2000)); },
};

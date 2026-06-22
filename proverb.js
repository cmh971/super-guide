const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('proverb')
    .setDescription("Get a wise proverb"),
  execute: async function (interaction) { const p = ['A journey of a thousand miles begins with a single step.', 'The early bird catches the worm.', 'Actions speak louder than words.', 'When in Rome, do as the Romans do.', 'Fortune favors the bold.']; await interaction.reply(`📜 *${p[Math.floor(Math.random() * p.length)]}*`); },
};

const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('bandname')
    .setDescription("Generate a random band name"),
  execute: async function (interaction) { const a = ['The Electric', 'Midnight', 'Velvet', 'Crimson', 'Neon', 'Broken', 'Wild', 'Silent', 'Cosmic', 'Golden']; const b = ['Tigers', 'Echoes', 'Wolves', 'Mirrors', 'Rebels', 'Ghosts', 'Dreamers', 'Saints', 'Riots', 'Waves']; await interaction.reply(`🎸 **${a[Math.floor(Math.random() * a.length)]} ${b[Math.floor(Math.random() * b.length)]}**`); },
};

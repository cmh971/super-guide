const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamertag')
    .setDescription("Generate a random gamertag"),
  execute: async function (interaction) { const a = ['Shadow', 'Toxic', 'Silent', 'Rapid', 'Frost', 'Pixel', 'Cyber', 'Ghost', 'Neon', 'Savage']; const b = ['Sniper', 'Wolf', 'Blade', 'Reaper', 'Storm', 'Viper', 'Hunter', 'Phantom', 'Knight', 'Fury']; await interaction.reply(`🎮 \`${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${Math.floor(Math.random() * 100)}\``); },
};

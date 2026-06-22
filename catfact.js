const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('catfact')
    .setDescription("Get a random cat fact"),
  execute: async function (interaction) { const f = ['Cats sleep 70% of their lives.', 'A group of cats is called a clowder.', 'Cats have 32 muscles in each ear.', 'A cat can jump up to 6x its length.', "Cats can't taste sweetness.", 'A cat\'s nose print is unique.']; await interaction.reply(`🐱 ${f[Math.floor(Math.random() * f.length)]}`); },
};

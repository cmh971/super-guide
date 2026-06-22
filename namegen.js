const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('namegen')
    .setDescription("Generate a random fantasy name"),
  execute: async function (interaction) { const a = ['Aer', 'Bran', 'Cor', 'Dra', 'El', 'Fen', 'Gor', 'Hal', 'Kael', 'Lyr', 'Mor', 'Nyx', 'Or', 'Syl', 'Thal', 'Vex']; const b = ['ion', 'wyn', 'dor', 'ith', 'ara', 'oth', 'iel', 'mar', 'und', 'eth', 'ora', 'ix']; await interaction.reply(`✨ ${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}`); },
};

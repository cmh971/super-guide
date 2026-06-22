const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('wheel')
    .setDescription("Spin a wheel of |-separated options")
    .addStringOption(op => op.setName('options').setDescription("e.g. pizza|tacos|sushi").setRequired(true)),
  execute: async function (interaction) { const o = interaction.options.getString('options').split('|').map((s) => s.trim()).filter(Boolean); if (o.length < 2) return interaction.reply('❌ Give at least 2 options separated by |'); await interaction.reply(`🎡 The wheel landed on: **${o[Math.floor(Math.random() * o.length)]}**`); },
};

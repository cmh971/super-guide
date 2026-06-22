const { SlashCommandBuilder } = require('discord.js');

// Utility — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrabble')
    .setDescription("Score a word in Scrabble points")
    .addStringOption(op => op.setName('word').setDescription("The word").setRequired(true)),
  execute: async function (interaction) { const vals = { 1: 'aeilnorstu', 2: 'dg', 3: 'bcmp', 4: 'fhvwy', 5: 'k', 8: 'jx', 10: 'qz' }; const score = {}; for (const p of Object.keys(vals)) for (const l of vals[p]) score[l] = +p; const w = interaction.options.getString('word').toLowerCase(); let total = 0; for (const c of w) total += score[c] || 0; await interaction.reply(`🔡 **${interaction.options.getString('word')}** scores **${total}** points in Scrabble.`); },
};

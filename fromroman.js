const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fromroman')
    .setDescription("Convert Roman numerals to a number")
    .addStringOption(op => op.setName('roman').setDescription("e.g. XIV").setRequired(true)),
  execute: async function (interaction) { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; const s = interaction.options.getString('roman').toUpperCase(); let total = 0; for (let i = 0; i < s.length; i++) { if (!v[s[i]]) return interaction.reply('❌ Invalid numeral.'); total += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]]; } await interaction.reply(`🔢 **${total}**`); },
};

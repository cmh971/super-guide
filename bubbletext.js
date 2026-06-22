const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('bubbletext')
    .setDescription("Ⓦⓡⓐⓟ your text in bubble letters")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const out = [...interaction.options.getString('text')].map((c) => { const u = c.toUpperCase(); if (u >= 'A' && u <= 'Z') return String.fromCodePoint((c === u ? 0x24b6 : 0x24d0) + (u.charCodeAt(0) - 65)); if (c >= '1' && c <= '9') return String.fromCodePoint(0x2460 + (c.charCodeAt(0) - 49)); if (c === '0') return '⓪'; return c; }).join(''); await interaction.reply(out.slice(0, 2000)); },
};

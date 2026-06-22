const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('hex2dec')
    .setDescription("Convert a hex value to decimal")
    .addStringOption(op => op.setName('hex').setDescription("e.g. FF").setRequired(true)),
  execute: async function (interaction) { const n = parseInt(interaction.options.getString('hex').replace(/^0x/i, ''), 16); await interaction.reply(isNaN(n) ? '❌ Invalid hex.' : `💻 **${n}**`); },
};

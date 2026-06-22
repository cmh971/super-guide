const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fromascii')
    .setDescription("Turn space-separated ASCII codes into text")
    .addStringOption(op => op.setName('codes').setDescription("e.g. 72 73").setRequired(true)),
  execute: async function (interaction) { try { await interaction.reply(interaction.options.getString('codes').trim().split(/\s+/).map((n) => String.fromCharCode(parseInt(n, 10))).join('').slice(0, 2000) || '(nothing)'); } catch { await interaction.reply('❌ Invalid codes.'); } },
};

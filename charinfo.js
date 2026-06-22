const { SlashCommandBuilder } = require('discord.js');

// Utility — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('charinfo')
    .setDescription("Show unicode info for the first character")
    .addStringOption(op => op.setName('char').setDescription("A character").setRequired(true)),
  execute: async function (interaction) { const c = [...interaction.options.getString('char')][0]; if (!c) return interaction.reply('❌ No character.'); const cp = c.codePointAt(0); await interaction.reply(`🔎 \`${c}\` → U+${cp.toString(16).toUpperCase().padStart(4, '0')} (decimal ${cp})`); },
};

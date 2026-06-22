const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('bin2dec')
    .setDescription("Convert binary to decimal")
    .addStringOption(op => op.setName('binary').setDescription("e.g. 1010").setRequired(true)),
  execute: async function (interaction) { const s = interaction.options.getString('binary'); await interaction.reply(/^[01]+$/.test(s) ? `💻 **${parseInt(s, 2)}**` : '❌ Invalid binary.'); },
};

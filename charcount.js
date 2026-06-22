const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('charcount')
    .setDescription("Count the characters in your text")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const t = interaction.options.getString('text'); await interaction.reply(`📏 **${t.length}** characters (**${t.replace(/\s/g, '').length}** without spaces).`); },
};

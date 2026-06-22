const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('conch')
    .setDescription("Ask the magic conch shell")
    .addStringOption(op => op.setName('question').setDescription("Your question").setRequired(true)),
  execute: async function (interaction) { const a = ['Yes', 'No', 'Maybe someday', 'Try asking again', 'I don\'t think so', 'Nothing', 'Neither']; await interaction.reply(`🐚 *${a[Math.floor(Math.random() * a.length)]}*`); },
};

const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('decide')
    .setDescription("Yes, no, or maybe?")
    .addStringOption(op => op.setName('question').setDescription("Your question").setRequired(false)),
  execute: async function (interaction) { const a = ['✅ Yes', '❌ No', '🤔 Maybe', '💯 Definitely', '🚫 Absolutely not', '⏳ Ask again later']; await interaction.reply(a[Math.floor(Math.random() * a.length)]); },
};

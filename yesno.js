const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('yesno')
    .setDescription("Get a random yes or no"),
  execute: async function (interaction) { await interaction.reply(Math.random() < 0.5 ? '✅ Yes' : '❌ No'); },
};

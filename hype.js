const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('hype')
    .setDescription("Get a hype message")
    .addStringOption(op => op.setName('user').setDescription("Who to hype").setRequired(false)),
  execute: async function (interaction) { const who = interaction.options.getString('user') || interaction.user.username; const h = ['is absolutely crushing it! 🔥', 'is a legend! 🏆', 'is built different! 💪', 'is on another level! 🚀', 'is the GOAT! 🐐']; await interaction.reply(`📣 **${who}** ${h[Math.floor(Math.random() * h.length)]}`); },
};

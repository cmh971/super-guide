const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('cookie')
    .setDescription("Crack open a fortune cookie"),
  execute: async function (interaction) { const f = ['A pleasant surprise is waiting for you.', 'Your hard work is about to pay off.', 'A new adventure is on the horizon.', 'Good things come to those who wait.', 'Today is your lucky day.']; await interaction.reply(`🥠 ${f[Math.floor(Math.random() * f.length)]}`); },
};

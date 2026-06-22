const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('riddle')
    .setDescription("Get a riddle (answer hidden)"),
  execute: async function (interaction) { const r = [['What has keys but no locks?', 'a keyboard'], ['What gets wetter as it dries?', 'a towel'], ['What has a neck but no head?', 'a bottle'], ['What can travel around the world while staying in a corner?', 'a stamp']]; const [q, a] = r[Math.floor(Math.random() * r.length)]; await interaction.reply(`🧩 ${q}\nAnswer: ||${a}||`); },
};

const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('neverhaveiever')
    .setDescription("Get a never-have-I-ever prompt"),
  execute: async function (interaction) { const n = ['...fallen asleep in class.', '...sent a text to the wrong person.', '...laughed at the wrong moment.', '...forgotten someone\'s name right after meeting them.', '...binged a whole series in one day.']; await interaction.reply(`🙊 Never have I ever ${n[Math.floor(Math.random() * n.length)]}`); },
};

const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dogfact')
    .setDescription("Get a random dog fact"),
  execute: async function (interaction) { const f = ['Dogs\' sense of smell is 40x ours.', 'A dog\'s nose print is unique.', 'Dalmatians are born pure white.', 'Dogs dream like humans do.', 'A greyhound can hit 45 mph.', 'Dogs have three eyelids.']; await interaction.reply(`🐶 ${f[Math.floor(Math.random() * f.length)]}`); },
};

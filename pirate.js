const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('pirate')
    .setDescription("Translate yer text to pirate speak, arr!")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const m = { hello: 'ahoy', hi: 'ahoy', my: 'me', friend: 'matey', friends: 'mateys', is: 'be', are: 'be', you: 'ye', your: 'yer', the: "th'", treasure: 'booty', money: 'doubloons', yes: 'aye', no: 'nay' }; const out = interaction.options.getString('text').split(/\s+/).map((w) => m[w.toLowerCase()] || w).join(' ') + ' arr!'; await interaction.reply(out.slice(0, 2000)); },
};

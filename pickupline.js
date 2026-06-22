const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('pickupline')
    .setDescription("Get a cheesy pickup line"),
  execute: async function (interaction) { const l = ['Are you a magician? Because whenever I look at you, everyone else disappears.', 'Do you have a map? I keep getting lost in your eyes.', 'Are you Wi-Fi? Because I\'m feeling a connection.', 'Is your name Google? Because you\'re everything I\'m searching for.']; await interaction.reply(`😏 ${l[Math.floor(Math.random() * l.length)]}`); },
};

const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('insult')
    .setDescription("Get a playful (SFW) insult")
    .addStringOption(op => op.setName('user').setDescription("Who to roast").setRequired(false)),
  execute: async function (interaction) { const who = interaction.options.getString('user') || 'you'; const i = ['has the charisma of a wet sock.', 'could lose an argument with a brick wall.', 'is proof that anyone can use a keyboard.', 'brings everyone so much joy... when they leave.']; await interaction.reply(`😈 ${who} ${i[Math.floor(Math.random() * i.length)]}`); },
};

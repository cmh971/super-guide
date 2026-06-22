const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('numemoji')
    .setDescription("Turn a number into keycap emojis")
    .addStringOption(op => op.setName('number').setDescription("The number").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(interaction.options.getString('number').replace(/[0-9]/g, (d) => d + '️⃣').slice(0, 2000)); },
};

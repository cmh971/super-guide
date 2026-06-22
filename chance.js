const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('chance')
    .setDescription("What are the chances of something?")
    .addStringOption(op => op.setName('thing').setDescription("The thing").setRequired(true)),
  execute: async function (interaction) { await interaction.reply(`🔮 Chance of **${interaction.options.getString('thing')}**: **${Math.floor(Math.random() * 101)}%**`); },
};

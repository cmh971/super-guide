const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lovecalc')
    .setDescription("Calculate the love % between two names")
    .addStringOption(op => op.setName('name1').setDescription("First name").setRequired(true))
    .addStringOption(op => op.setName('name2').setDescription("Second name").setRequired(true)),
  execute: async function (interaction) { const s = (interaction.options.getString('name1') + interaction.options.getString('name2')).toLowerCase(); let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 101; await interaction.reply(`💘 **${interaction.options.getString('name1')}** + **${interaction.options.getString('name2')}** = **${h}%** 💕`); },
};

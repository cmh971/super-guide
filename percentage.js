const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('percentage')
    .setDescription("What percent is part of whole")
    .addNumberOption(op => op.setName('part').setDescription("The part").setRequired(true))
    .addNumberOption(op => op.setName('whole').setDescription("The whole").setRequired(true)),
  execute: async function (interaction) { const w = interaction.options.getNumber('whole'); if (w === 0) return interaction.reply('❌ Whole cannot be zero.'); await interaction.reply(`📊 ${interaction.options.getNumber('part')} is **${(interaction.options.getNumber('part') / w * 100).toFixed(2)}%** of ${w}.`); },
};

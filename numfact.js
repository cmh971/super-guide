const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('numfact')
    .setDescription("A fun fact about a number")
    .addIntegerOption(op => op.setName('number').setDescription("The number").setRequired(true)),
  execute: async function (interaction) { const n = interaction.options.getInteger('number'); const facts = [`${n} is ${n % 2 === 0 ? 'even' : 'odd'}.`, `${n} squared is ${n * n}.`, `In binary, ${n} is ${(n >>> 0).toString(2)}.`, `${n} doubled is ${n * 2}.`]; await interaction.reply(`🔢 ${facts[Math.floor(Math.random() * facts.length)]}`); },
};

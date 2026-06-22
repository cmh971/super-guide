const { SlashCommandBuilder } = require('discord.js');

// Random — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rpsls')
    .setDescription("Rock paper scissors lizard spock")
    .addStringOption(op => op.setName('move').setDescription("Your move").setRequired(true).addChoices({ name: "rock", value: "rock" }, { name: "paper", value: "paper" }, { name: "scissors", value: "scissors" }, { name: "lizard", value: "lizard" }, { name: "spock", value: "spock" })),
  execute: async function (interaction) { const moves = ['rock', 'paper', 'scissors', 'lizard', 'spock']; const beats = { rock: ['scissors', 'lizard'], paper: ['rock', 'spock'], scissors: ['paper', 'lizard'], lizard: ['spock', 'paper'], spock: ['scissors', 'rock'] }; const you = interaction.options.getString('move'); const bot = moves[Math.floor(Math.random() * 5)]; const res = you === bot ? "It's a tie!" : beats[you].includes(bot) ? 'You win! 🎉' : 'You lose! 😢'; await interaction.reply(`You: **${you}** vs Bot: **${bot}** → ${res}`); },
};

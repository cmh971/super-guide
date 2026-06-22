const { SlashCommandBuilder } = require('discord.js');

// Math — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('bmi')
    .setDescription("Calculate body mass index")
    .addNumberOption(op => op.setName('kg').setDescription("Weight in kg").setRequired(true))
    .addNumberOption(op => op.setName('cm').setDescription("Height in cm").setRequired(true)),
  execute: async function (interaction) { const m = interaction.options.getNumber('cm') / 100; const bmi = interaction.options.getNumber('kg') / (m * m); const cat = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese'; await interaction.reply(`⚖️ BMI = **${bmi.toFixed(1)}** (${cat}).`); },
};

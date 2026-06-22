const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('weight')
    .setDescription("Convert weight units")
    .addNumberOption(op => op.setName('value').setDescription("The value").setRequired(true))
    .addStringOption(op => op.setName('from').setDescription("From").setRequired(true).addChoices({ name: "grams", value: "g" }, { name: "kilograms", value: "kg" }, { name: "pounds", value: "lb" }, { name: "ounces", value: "oz" }))
    .addStringOption(op => op.setName('to').setDescription("To").setRequired(true).addChoices({ name: "grams", value: "g" }, { name: "kilograms", value: "kg" }, { name: "pounds", value: "lb" }, { name: "ounces", value: "oz" })),
  execute: async function (interaction) { const u = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495 }; const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); await interaction.reply(`⚖️ ${v} ${f} = **${(v * u[f] / u[t]).toFixed(4)} ${t}**`); },
};

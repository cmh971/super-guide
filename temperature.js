const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('temperature')
    .setDescription("Convert between °C, °F and K")
    .addNumberOption(op => op.setName('value').setDescription("The value").setRequired(true))
    .addStringOption(op => op.setName('from').setDescription("From unit").setRequired(true).addChoices({ name: "Celsius", value: "c" }, { name: "Fahrenheit", value: "f" }, { name: "Kelvin", value: "k" }))
    .addStringOption(op => op.setName('to').setDescription("To unit").setRequired(true).addChoices({ name: "Celsius", value: "c" }, { name: "Fahrenheit", value: "f" }, { name: "Kelvin", value: "k" })),
  execute: async function (interaction) { const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); const c = f === 'c' ? v : f === 'f' ? (v - 32) * 5 / 9 : v - 273.15; const out = t === 'c' ? c : t === 'f' ? c * 9 / 5 + 32 : c + 273.15; await interaction.reply(`🌡️ ${v}${f.toUpperCase()} = **${(Math.round(out * 100) / 100)}${t.toUpperCase()}**`); },
};

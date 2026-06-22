const { SlashCommandBuilder } = require('discord.js');

// Convert — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('distance')
    .setDescription("Convert distance units")
    .addNumberOption(op => op.setName('value').setDescription("The value").setRequired(true))
    .addStringOption(op => op.setName('from').setDescription("From").setRequired(true).addChoices({ name: "meters", value: "m" }, { name: "kilometers", value: "km" }, { name: "miles", value: "mi" }, { name: "feet", value: "ft" }))
    .addStringOption(op => op.setName('to').setDescription("To").setRequired(true).addChoices({ name: "meters", value: "m" }, { name: "kilometers", value: "km" }, { name: "miles", value: "mi" }, { name: "feet", value: "ft" })),
  execute: async function (interaction) { const u = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 }; const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); await interaction.reply(`📏 ${v} ${f} = **${(v * u[f] / u[t]).toFixed(4)} ${t}**`); },
};

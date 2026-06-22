const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('zalgo')
    .setDescription("C̷o̷r̷r̷u̷p̷t̷ your text with glitchy marks")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const marks = [0x300, 0x301, 0x302, 0x303, 0x308, 0x30a, 0x327, 0x336, 0x489]; let out = ''; for (const ch of interaction.options.getString('text')) { out += ch; const n = 1 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) out += String.fromCharCode(marks[Math.floor(Math.random() * marks.length)]); } await interaction.reply(out.slice(0, 2000)); },
};

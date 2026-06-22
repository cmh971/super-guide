const { SlashCommandBuilder } = require('discord.js');

// Fun — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lorem')
    .setDescription("Generate placeholder lorem ipsum text")
    .addIntegerOption(op => op.setName('sentences').setDescription("How many (1-15)").setRequired(true)),
  execute: async function (interaction) { const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' '); const n = Math.min(15, Math.max(1, interaction.options.getInteger('sentences'))); let out = []; for (let s = 0; s < n; s++) { const len = 6 + Math.floor(Math.random() * 8); let sent = []; for (let i = 0; i < len; i++) sent.push(words[Math.floor(Math.random() * words.length)]); sent[0] = sent[0][0].toUpperCase() + sent[0].slice(1); out.push(sent.join(' ') + '.'); } await interaction.reply(out.join(' ').slice(0, 2000)); },
};

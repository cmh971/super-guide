const { SlashCommandBuilder } = require('discord.js');

// Text — auto-generated command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('braille')
    .setDescription("Convert text to braille ⠃⠗⠁⠊⠇⠇⠑")
    .addStringOption(op => op.setName('text').setDescription("The text to use").setRequired(true)),
  execute: async function (interaction) { const b = { a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚', k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞', u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵', ' ': ' ' }; await interaction.reply(interaction.options.getString('text').toLowerCase().split('').map((c) => b[c] || c).join('').slice(0, 2000)); },
};

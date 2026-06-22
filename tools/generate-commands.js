'use strict';

/**
 * Generates 81 new self-contained slash-command files into the bot root.
 *
 * The bot's index.js loader only scans the root folder (non-recursive), so this
 * generator lives under /tools (ignored by the loader) and writes finished
 * command modules next to the existing ones.
 *
 * Each spec's `run` function is serialized via Function#toString into the file,
 * so what you read here is exactly what executes. Run with:
 *   node tools/generate-commands.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// --- option code generation -------------------------------------------------
function genOption(o) {
  const add = {
    string: 'addStringOption',
    int: 'addIntegerOption',
    number: 'addNumberOption',
    bool: 'addBooleanOption',
  }[o.kind];
  let inner = `op => op.setName('${o.name}').setDescription(${JSON.stringify(o.desc)}).setRequired(${o.required !== false})`;
  if (o.choices) {
    const ch = o.choices.map((c) => `{ name: ${JSON.stringify(c.name)}, value: ${JSON.stringify(c.value)} }`).join(', ');
    inner += `.addChoices(${ch})`;
  }
  return `    .${add}(${inner})`;
}

function fileContents(spec) {
  const opts = (spec.options || []).map(genOption).join('\n');
  const dataExpr =
    `new SlashCommandBuilder()\n    .setName('${spec.name}')\n    .setDescription(${JSON.stringify(spec.desc)})` +
    (opts ? `\n${opts}` : '');
  return `const { SlashCommandBuilder } = require('discord.js');\n\n` +
    `// ${spec.category} — auto-generated command.\n` +
    `module.exports = {\n` +
    `  data: ${dataExpr},\n` +
    `  execute: ${spec.run.toString()},\n` +
    `};\n`;
}

// Common option shapes.
const TEXT = { kind: 'string', name: 'text', desc: 'The text to use' };
const N = (name, desc) => ({ kind: 'number', name, desc });
const I = (name, desc) => ({ kind: 'int', name, desc });

// ---------------------------------------------------------------------------
// The 81 commands.
// ---------------------------------------------------------------------------
const COMMANDS = [
  // ----- Text transforms ---------------------------------------------------
  { name: 'uppercase', category: 'Text', desc: 'SHOUT your text in all caps', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').toUpperCase().slice(0, 2000)); } },

  { name: 'lowercase', category: 'Text', desc: 'make your text all lowercase', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').toLowerCase().slice(0, 2000)); } },

  { name: 'titlecase', category: 'Text', desc: 'Capitalize Each Word', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 2000)); } },

  { name: 'clap', category: 'Text', desc: 'Put 👏 clap 👏 emojis 👏 between words', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').trim().split(/\s+/).join(' 👏 ').slice(0, 2000)); } },

  { name: 'spongebob', category: 'Text', desc: 'mOcK tExT lIkE sPoNgEbOb', options: [TEXT],
    run: async function (interaction) { let i = 0; await interaction.reply(interaction.options.getString('text').replace(/[a-z]/gi, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase())).slice(0, 2000)); } },

  { name: 'stutter', category: 'Text', desc: 'A-add a st-stutter to your text', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').split(/\s+/).map((w) => (w[0] ? `${w[0]}-${w}` : w)).join(' ').slice(0, 2000)); } },

  { name: 'pirate', category: 'Text', desc: 'Translate yer text to pirate speak, arr!', options: [TEXT],
    run: async function (interaction) { const m = { hello: 'ahoy', hi: 'ahoy', my: 'me', friend: 'matey', friends: 'mateys', is: 'be', are: 'be', you: 'ye', your: 'yer', the: "th'", treasure: 'booty', money: 'doubloons', yes: 'aye', no: 'nay' }; const out = interaction.options.getString('text').split(/\s+/).map((w) => m[w.toLowerCase()] || w).join(' ') + ' arr!'; await interaction.reply(out.slice(0, 2000)); } },

  { name: 'owoify', category: 'Text', desc: 'Convert text to owo speak uwu', options: [TEXT],
    run: async function (interaction) { let t = interaction.options.getString('text').replace(/[rl]/g, 'w').replace(/[RL]/g, 'W').replace(/n([aeiou])/g, 'ny$1'); const faces = [' uwu', ' owo', ' >w<', ' ^w^']; await interaction.reply((t + faces[Math.floor(Math.random() * faces.length)]).slice(0, 2000)); } },

  { name: 'zalgo', category: 'Text', desc: 'C̷o̷r̷r̷u̷p̷t̷ your text with glitchy marks', options: [TEXT],
    run: async function (interaction) { const marks = [0x300, 0x301, 0x302, 0x303, 0x308, 0x30a, 0x327, 0x336, 0x489]; let out = ''; for (const ch of interaction.options.getString('text')) { out += ch; const n = 1 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) out += String.fromCharCode(marks[Math.floor(Math.random() * marks.length)]); } await interaction.reply(out.slice(0, 2000)); } },

  { name: 'bubbletext', category: 'Text', desc: 'Ⓦⓡⓐⓟ your text in bubble letters', options: [TEXT],
    run: async function (interaction) { const out = [...interaction.options.getString('text')].map((c) => { const u = c.toUpperCase(); if (u >= 'A' && u <= 'Z') return String.fromCodePoint((c === u ? 0x24b6 : 0x24d0) + (u.charCodeAt(0) - 65)); if (c >= '1' && c <= '9') return String.fromCodePoint(0x2460 + (c.charCodeAt(0) - 49)); if (c === '0') return '⓪'; return c; }).join(''); await interaction.reply(out.slice(0, 2000)); } },

  { name: 'smallcaps', category: 'Text', desc: 'ᴄᴏɴᴠᴇʀᴛ text to small caps', options: [TEXT],
    run: async function (interaction) { const map = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' }; await interaction.reply(interaction.options.getString('text').toLowerCase().split('').map((c) => map[c] || c).join('').slice(0, 2000)); } },

  { name: 'spaceout', category: 'Text', desc: 'S p a c e   o u t   your text', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').split('').join(' ').slice(0, 2000)); } },

  { name: 'piglatin', category: 'Text', desc: 'Translate-ay to pig latin', options: [TEXT],
    run: async function (interaction) { const pig = (w) => { const m = w.match(/^([^aeiou]+)(.*)$/i); return m && m[2] ? m[2] + m[1] + 'ay' : w + 'way'; }; await interaction.reply(interaction.options.getString('text').split(/\s+/).map(pig).join(' ').slice(0, 2000)); } },

  { name: 'charcount', category: 'Text', desc: 'Count the characters in your text', options: [TEXT],
    run: async function (interaction) { const t = interaction.options.getString('text'); await interaction.reply(`📏 **${t.length}** characters (**${t.replace(/\s/g, '').length}** without spaces).`); } },

  { name: 'vowelcount', category: 'Text', desc: 'Count the vowels in your text', options: [TEXT],
    run: async function (interaction) { const v = (interaction.options.getString('text').match(/[aeiou]/gi) || []).length; await interaction.reply(`🔤 Your text has **${v}** vowels.`); } },

  { name: 'mirrortext', category: 'Text', desc: 'Reverse your text backwards', options: [TEXT],
    run: async function (interaction) { await interaction.reply([...interaction.options.getString('text')].reverse().join('').slice(0, 2000)); } },

  { name: 'reverseeach', category: 'Text', desc: 'Reverse the letters in each word', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').split(/\s+/).map((w) => [...w].reverse().join('')).join(' ').slice(0, 2000)); } },

  { name: 'redact', category: 'Text', desc: 'Black out your text ██████', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').replace(/\S/g, '█').slice(0, 2000)); } },

  { name: 'shuffleletters', category: 'Text', desc: 'Shuffle the letters in each word', options: [TEXT],
    run: async function (interaction) { const sh = (w) => { const a = [...w]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(''); }; await interaction.reply(interaction.options.getString('text').split(/\s+/).map(sh).join(' ').slice(0, 2000)); } },

  { name: 'rot13', category: 'Text', desc: 'Apply the ROT13 cipher to your text', options: [TEXT],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('text').replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c.charCodeAt(0) + 13) ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)).slice(0, 2000)); } },

  { name: 'asciicode', category: 'Text', desc: 'Show the ASCII codes of your text', options: [TEXT],
    run: async function (interaction) { await interaction.reply('```' + [...interaction.options.getString('text')].map((c) => c.charCodeAt(0)).join(' ').slice(0, 1990) + '```'); } },

  { name: 'fromascii', category: 'Text', desc: 'Turn space-separated ASCII codes into text', options: [{ kind: 'string', name: 'codes', desc: 'e.g. 72 73' }],
    run: async function (interaction) { try { await interaction.reply(interaction.options.getString('codes').trim().split(/\s+/).map((n) => String.fromCharCode(parseInt(n, 10))).join('').slice(0, 2000) || '(nothing)'); } catch { await interaction.reply('❌ Invalid codes.'); } } },

  { name: 'emojiletters', category: 'Text', desc: '🇹🇺🇷🇳 text into regional indicator emojis', options: [TEXT],
    run: async function (interaction) { const out = interaction.options.getString('text').toLowerCase().split('').map((c) => (c >= 'a' && c <= 'z') ? String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 97) + ' ' : c).join(''); await interaction.reply(out.slice(0, 2000)); } },

  { name: 'flip', category: 'Text', desc: 'Flip your text uʍop ǝpᴉsdn', options: [TEXT],
    run: async function (interaction) { const m = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', '?': '¿', '!': '¡' }; await interaction.reply([...interaction.options.getString('text').toLowerCase()].reverse().map((c) => m[c] || c).join('').slice(0, 2000)); } },

  { name: 'nato', category: 'Text', desc: 'Spell text with the NATO phonetic alphabet', options: [TEXT],
    run: async function (interaction) { const n = { a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'Xray', y: 'Yankee', z: 'Zulu' }; await interaction.reply(interaction.options.getString('text').toLowerCase().split('').map((c) => n[c] || (c === ' ' ? '/' : c)).join(' ').slice(0, 2000)); } },

  { name: 'braille', category: 'Text', desc: 'Convert text to braille ⠃⠗⠁⠊⠇⠇⠑', options: [TEXT],
    run: async function (interaction) { const b = { a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚', k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞', u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵', ' ': ' ' }; await interaction.reply(interaction.options.getString('text').toLowerCase().split('').map((c) => b[c] || c).join('').slice(0, 2000)); } },

  { name: 'numemoji', category: 'Text', desc: 'Turn a number into keycap emojis', options: [{ kind: 'string', name: 'number', desc: 'The number' }],
    run: async function (interaction) { await interaction.reply(interaction.options.getString('number').replace(/[0-9]/g, (d) => d + '️⃣').slice(0, 2000)); } },

  { name: 'slugify', category: 'Text', desc: 'Make a url-friendly slug from text', options: [TEXT],
    run: async function (interaction) { await interaction.reply('`' + (interaction.options.getString('text').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'empty') + '`'); } },

  { name: 'acronym', category: 'Text', desc: 'Build an acronym from the first letters', options: [TEXT],
    run: async function (interaction) { await interaction.reply('🔠 ' + interaction.options.getString('text').split(/\s+/).map((w) => (w[0] || '').toUpperCase()).join('')); } },

  { name: 'textstats', category: 'Text', desc: 'Show stats about your text', options: [TEXT],
    run: async function (interaction) { const t = interaction.options.getString('text'); const words = t.trim().split(/\s+/).filter(Boolean); const sentences = t.split(/[.!?]+/).filter((s) => s.trim()).length; await interaction.reply(`📊 **Chars:** ${t.length} | **Words:** ${words.length} | **Sentences:** ${sentences} | **Avg word len:** ${(words.reduce((a, w) => a + w.length, 0) / (words.length || 1)).toFixed(1)}`); } },

  { name: 'syllables', category: 'Text', desc: 'Estimate the syllables in a word', options: [{ kind: 'string', name: 'word', desc: 'The word' }],
    run: async function (interaction) { const w = interaction.options.getString('word').toLowerCase(); const c = (w.match(/[aeiouy]+/g) || []).length - (w.endsWith('e') ? 1 : 0); await interaction.reply(`🗣️ **${interaction.options.getString('word')}** has about **${Math.max(1, c)}** syllable(s).`); } },

  // ----- Math & converters -------------------------------------------------
  { name: 'factorial', category: 'Math', desc: 'Calculate n! (factorial)', options: [I('n', '0 to 170')],
    run: async function (interaction) { const n = interaction.options.getInteger('n'); if (n < 0 || n > 170) return interaction.reply('❌ Enter a number between 0 and 170.'); let r = 1; for (let i = 2; i <= n; i++) r *= i; await interaction.reply(`🧮 ${n}! = **${r}**`); } },

  { name: 'fibonacci', category: 'Math', desc: 'Get the nth Fibonacci number', options: [I('n', '0 to 90')],
    run: async function (interaction) { const n = interaction.options.getInteger('n'); if (n < 0 || n > 90) return interaction.reply('❌ Enter 0 to 90.'); let a = 0n; let b = 1n; for (let i = 0; i < n; i++) { [a, b] = [b, a + b]; } await interaction.reply(`🔢 Fibonacci(${n}) = **${a.toString()}**`); } },

  { name: 'isprime', category: 'Math', desc: 'Check whether a number is prime', options: [I('n', 'The number')],
    run: async function (interaction) { const n = interaction.options.getInteger('n'); let p = n > 1; for (let i = 2; i <= Math.sqrt(n); i++) { if (n % i === 0) { p = false; break; } } await interaction.reply(`${p ? '✅' : '❌'} **${n}** is ${p ? '' : 'not '}prime.`); } },

  { name: 'gcd', category: 'Math', desc: 'Greatest common divisor of two numbers', options: [I('a', 'First'), I('b', 'Second')],
    run: async function (interaction) { let a = Math.abs(interaction.options.getInteger('a')); let b = Math.abs(interaction.options.getInteger('b')); while (b) { [a, b] = [b, a % b]; } await interaction.reply(`🧮 GCD = **${a}**`); } },

  { name: 'lcm', category: 'Math', desc: 'Least common multiple of two numbers', options: [I('a', 'First'), I('b', 'Second')],
    run: async function (interaction) { const x = interaction.options.getInteger('a'); const y = interaction.options.getInteger('b'); let a = Math.abs(x); let b = Math.abs(y); while (b) { [a, b] = [b, a % b]; } await interaction.reply(`🧮 LCM = **${a ? Math.abs(x * y) / a : 0}**`); } },

  { name: 'power', category: 'Math', desc: 'Raise a base to an exponent', options: [N('base', 'The base'), N('exponent', 'The exponent')],
    run: async function (interaction) { await interaction.reply(`🧮 ${interaction.options.getNumber('base')} ^ ${interaction.options.getNumber('exponent')} = **${Math.pow(interaction.options.getNumber('base'), interaction.options.getNumber('exponent'))}**`); } },

  { name: 'squareroot', category: 'Math', desc: 'Calculate the square root', options: [N('value', 'The number')],
    run: async function (interaction) { const v = interaction.options.getNumber('value'); if (v < 0) return interaction.reply('❌ Cannot square-root a negative.'); await interaction.reply(`🧮 √${v} = **${Math.sqrt(v)}**`); } },

  { name: 'modulo', category: 'Math', desc: 'Remainder of a divided by b', options: [N('a', 'Dividend'), N('b', 'Divisor')],
    run: async function (interaction) { const b = interaction.options.getNumber('b'); if (b === 0) return interaction.reply('❌ Cannot divide by zero.'); await interaction.reply(`🧮 ${interaction.options.getNumber('a')} mod ${b} = **${interaction.options.getNumber('a') % b}**`); } },

  { name: 'percentage', category: 'Math', desc: 'What percent is part of whole', options: [N('part', 'The part'), N('whole', 'The whole')],
    run: async function (interaction) { const w = interaction.options.getNumber('whole'); if (w === 0) return interaction.reply('❌ Whole cannot be zero.'); await interaction.reply(`📊 ${interaction.options.getNumber('part')} is **${(interaction.options.getNumber('part') / w * 100).toFixed(2)}%** of ${w}.`); } },

  { name: 'average', category: 'Math', desc: 'Average of space-separated numbers', options: [{ kind: 'string', name: 'numbers', desc: 'e.g. 4 8 15 16' }],
    run: async function (interaction) { const ns = interaction.options.getString('numbers').trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)); if (!ns.length) return interaction.reply('❌ No valid numbers.'); await interaction.reply(`📊 Average of ${ns.length} numbers = **${(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(2)}**`); } },

  { name: 'tip', category: 'Math', desc: 'Calculate a tip and total', options: [N('bill', 'Bill amount'), N('percent', 'Tip %')],
    run: async function (interaction) { const b = interaction.options.getNumber('bill'); const p = interaction.options.getNumber('percent'); const t = b * p / 100; await interaction.reply(`💵 Tip: **$${t.toFixed(2)}** | Total: **$${(b + t).toFixed(2)}**`); } },

  { name: 'bmi', category: 'Math', desc: 'Calculate body mass index', options: [N('kg', 'Weight in kg'), N('cm', 'Height in cm')],
    run: async function (interaction) { const m = interaction.options.getNumber('cm') / 100; const bmi = interaction.options.getNumber('kg') / (m * m); const cat = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese'; await interaction.reply(`⚖️ BMI = **${bmi.toFixed(1)}** (${cat}).`); } },

  { name: 'temperature', category: 'Convert', desc: 'Convert between °C, °F and K',
    options: [N('value', 'The value'),
      { kind: 'string', name: 'from', desc: 'From unit', choices: [{ name: 'Celsius', value: 'c' }, { name: 'Fahrenheit', value: 'f' }, { name: 'Kelvin', value: 'k' }] },
      { kind: 'string', name: 'to', desc: 'To unit', choices: [{ name: 'Celsius', value: 'c' }, { name: 'Fahrenheit', value: 'f' }, { name: 'Kelvin', value: 'k' }] }],
    run: async function (interaction) { const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); const c = f === 'c' ? v : f === 'f' ? (v - 32) * 5 / 9 : v - 273.15; const out = t === 'c' ? c : t === 'f' ? c * 9 / 5 + 32 : c + 273.15; await interaction.reply(`🌡️ ${v}${f.toUpperCase()} = **${(Math.round(out * 100) / 100)}${t.toUpperCase()}**`); } },

  { name: 'distance', category: 'Convert', desc: 'Convert distance units',
    options: [N('value', 'The value'),
      { kind: 'string', name: 'from', desc: 'From', choices: [{ name: 'meters', value: 'm' }, { name: 'kilometers', value: 'km' }, { name: 'miles', value: 'mi' }, { name: 'feet', value: 'ft' }] },
      { kind: 'string', name: 'to', desc: 'To', choices: [{ name: 'meters', value: 'm' }, { name: 'kilometers', value: 'km' }, { name: 'miles', value: 'mi' }, { name: 'feet', value: 'ft' }] }],
    run: async function (interaction) { const u = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 }; const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); await interaction.reply(`📏 ${v} ${f} = **${(v * u[f] / u[t]).toFixed(4)} ${t}**`); } },

  { name: 'weight', category: 'Convert', desc: 'Convert weight units',
    options: [N('value', 'The value'),
      { kind: 'string', name: 'from', desc: 'From', choices: [{ name: 'grams', value: 'g' }, { name: 'kilograms', value: 'kg' }, { name: 'pounds', value: 'lb' }, { name: 'ounces', value: 'oz' }] },
      { kind: 'string', name: 'to', desc: 'To', choices: [{ name: 'grams', value: 'g' }, { name: 'kilograms', value: 'kg' }, { name: 'pounds', value: 'lb' }, { name: 'ounces', value: 'oz' }] }],
    run: async function (interaction) { const u = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495 }; const v = interaction.options.getNumber('value'); const f = interaction.options.getString('from'); const t = interaction.options.getString('to'); await interaction.reply(`⚖️ ${v} ${f} = **${(v * u[f] / u[t]).toFixed(4)} ${t}**`); } },

  { name: 'roman', category: 'Convert', desc: 'Convert a number to Roman numerals', options: [I('number', '1 to 3999')],
    run: async function (interaction) { let n = interaction.options.getInteger('number'); if (n < 1 || n > 3999) return interaction.reply('❌ 1 to 3999 only.'); const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let out = ''; for (const [v, s] of t) { while (n >= v) { out += s; n -= v; } } await interaction.reply(`🏛️ **${out}**`); } },

  { name: 'fromroman', category: 'Convert', desc: 'Convert Roman numerals to a number', options: [{ kind: 'string', name: 'roman', desc: 'e.g. XIV' }],
    run: async function (interaction) { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; const s = interaction.options.getString('roman').toUpperCase(); let total = 0; for (let i = 0; i < s.length; i++) { if (!v[s[i]]) return interaction.reply('❌ Invalid numeral.'); total += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]]; } await interaction.reply(`🔢 **${total}**`); } },

  { name: 'dec2bin', category: 'Convert', desc: 'Convert a decimal number to binary', options: [I('number', 'Decimal number')],
    run: async function (interaction) { await interaction.reply(`💻 \`${(interaction.options.getInteger('number') >>> 0).toString(2)}\``); } },

  { name: 'dec2hex', category: 'Convert', desc: 'Convert a decimal number to hex', options: [I('number', 'Decimal number')],
    run: async function (interaction) { await interaction.reply(`💻 \`0x${(interaction.options.getInteger('number') >>> 0).toString(16).toUpperCase()}\``); } },

  { name: 'hex2dec', category: 'Convert', desc: 'Convert a hex value to decimal', options: [{ kind: 'string', name: 'hex', desc: 'e.g. FF' }],
    run: async function (interaction) { const n = parseInt(interaction.options.getString('hex').replace(/^0x/i, ''), 16); await interaction.reply(isNaN(n) ? '❌ Invalid hex.' : `💻 **${n}**`); } },

  { name: 'bin2dec', category: 'Convert', desc: 'Convert binary to decimal', options: [{ kind: 'string', name: 'binary', desc: 'e.g. 1010' }],
    run: async function (interaction) { const s = interaction.options.getString('binary'); await interaction.reply(/^[01]+$/.test(s) ? `💻 **${parseInt(s, 2)}**` : '❌ Invalid binary.'); } },

  // ----- Random / dice -----------------------------------------------------
  { name: 'rng', category: 'Random', desc: 'Random number in a range', options: [I('min', 'Minimum'), I('max', 'Maximum')],
    run: async function (interaction) { const a = interaction.options.getInteger('min'); const b = interaction.options.getInteger('max'); const lo = Math.min(a, b); const hi = Math.max(a, b); await interaction.reply(`🎲 **${Math.floor(Math.random() * (hi - lo + 1)) + lo}**`); } },

  { name: 'd20', category: 'Random', desc: 'Roll a 20-sided die', options: [],
    run: async function (interaction) { const r = Math.floor(Math.random() * 20) + 1; await interaction.reply(`🎲 You rolled a **${r}**${r === 20 ? ' — NAT 20! 🎉' : r === 1 ? ' — critical fail 💀' : ''}`); } },

  { name: 'd6', category: 'Random', desc: 'Roll a 6-sided die', options: [],
    run: async function (interaction) { await interaction.reply(`🎲 You rolled a **${Math.floor(Math.random() * 6) + 1}**`); } },

  { name: 'flipcoins', category: 'Random', desc: 'Flip several coins at once', options: [I('count', 'How many (1-100)')],
    run: async function (interaction) { const n = Math.min(100, Math.max(1, interaction.options.getInteger('count'))); let h = 0; for (let i = 0; i < n; i++) if (Math.random() < 0.5) h++; await interaction.reply(`🪙 ${n} flips → **${h}** heads, **${n - h}** tails.`); } },

  { name: 'chance', category: 'Random', desc: 'What are the chances of something?', options: [{ kind: 'string', name: 'thing', desc: 'The thing' }],
    run: async function (interaction) { await interaction.reply(`🔮 Chance of **${interaction.options.getString('thing')}**: **${Math.floor(Math.random() * 101)}%**`); } },

  { name: 'yesno', category: 'Random', desc: 'Get a random yes or no', options: [],
    run: async function (interaction) { await interaction.reply(Math.random() < 0.5 ? '✅ Yes' : '❌ No'); } },

  { name: 'decide', category: 'Random', desc: 'Yes, no, or maybe?', options: [{ kind: 'string', name: 'question', desc: 'Your question', required: false }],
    run: async function (interaction) { const a = ['✅ Yes', '❌ No', '🤔 Maybe', '💯 Definitely', '🚫 Absolutely not', '⏳ Ask again later']; await interaction.reply(a[Math.floor(Math.random() * a.length)]); } },

  { name: 'wheel', category: 'Random', desc: 'Spin a wheel of |-separated options', options: [{ kind: 'string', name: 'options', desc: 'e.g. pizza|tacos|sushi' }],
    run: async function (interaction) { const o = interaction.options.getString('options').split('|').map((s) => s.trim()).filter(Boolean); if (o.length < 2) return interaction.reply('❌ Give at least 2 options separated by |'); await interaction.reply(`🎡 The wheel landed on: **${o[Math.floor(Math.random() * o.length)]}**`); } },

  { name: 'lovecalc', category: 'Random', desc: 'Calculate the love % between two names', options: [{ kind: 'string', name: 'name1', desc: 'First name' }, { kind: 'string', name: 'name2', desc: 'Second name' }],
    run: async function (interaction) { const s = (interaction.options.getString('name1') + interaction.options.getString('name2')).toLowerCase(); let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 101; await interaction.reply(`💘 **${interaction.options.getString('name1')}** + **${interaction.options.getString('name2')}** = **${h}%** 💕`); } },

  { name: 'rpsls', category: 'Random', desc: 'Rock paper scissors lizard spock', options: [{ kind: 'string', name: 'move', desc: 'Your move', choices: [{ name: 'rock', value: 'rock' }, { name: 'paper', value: 'paper' }, { name: 'scissors', value: 'scissors' }, { name: 'lizard', value: 'lizard' }, { name: 'spock', value: 'spock' }] }],
    run: async function (interaction) { const moves = ['rock', 'paper', 'scissors', 'lizard', 'spock']; const beats = { rock: ['scissors', 'lizard'], paper: ['rock', 'spock'], scissors: ['paper', 'lizard'], lizard: ['spock', 'paper'], spock: ['scissors', 'rock'] }; const you = interaction.options.getString('move'); const bot = moves[Math.floor(Math.random() * 5)]; const res = you === bot ? "It's a tie!" : beats[you].includes(bot) ? 'You win! 🎉' : 'You lose! 😢'; await interaction.reply(`You: **${you}** vs Bot: **${bot}** → ${res}`); } },

  { name: 'conch', category: 'Random', desc: 'Ask the magic conch shell', options: [{ kind: 'string', name: 'question', desc: 'Your question' }],
    run: async function (interaction) { const a = ['Yes', 'No', 'Maybe someday', 'Try asking again', 'I don\'t think so', 'Nothing', 'Neither']; await interaction.reply(`🐚 *${a[Math.floor(Math.random() * a.length)]}*`); } },

  { name: 'randomemoji', category: 'Random', desc: 'Get a random emoji', options: [],
    run: async function (interaction) { const e = ['😀', '🎉', '🚀', '🦄', '🍕', '🐸', '🔥', '💎', '🌈', '👾', '🍩', '🦖', '⚡', '🎲', '🪐', '🥑']; await interaction.reply(e[Math.floor(Math.random() * e.length)]); } },

  { name: 'randomhex', category: 'Random', desc: 'Generate a random hex color', options: [],
    run: async function (interaction) { const h = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase(); const { EmbedBuilder } = require('discord.js'); await interaction.reply({ embeds: [new EmbedBuilder().setTitle(h).setColor(h).setDescription('Your random color')] }); } },

  // ----- Fun / static lists ------------------------------------------------
  { name: 'catfact', category: 'Fun', desc: 'Get a random cat fact', options: [],
    run: async function (interaction) { const f = ['Cats sleep 70% of their lives.', 'A group of cats is called a clowder.', 'Cats have 32 muscles in each ear.', 'A cat can jump up to 6x its length.', "Cats can't taste sweetness.", 'A cat\'s nose print is unique.']; await interaction.reply(`🐱 ${f[Math.floor(Math.random() * f.length)]}`); } },

  { name: 'dogfact', category: 'Fun', desc: 'Get a random dog fact', options: [],
    run: async function (interaction) { const f = ['Dogs\' sense of smell is 40x ours.', 'A dog\'s nose print is unique.', 'Dalmatians are born pure white.', 'Dogs dream like humans do.', 'A greyhound can hit 45 mph.', 'Dogs have three eyelids.']; await interaction.reply(`🐶 ${f[Math.floor(Math.random() * f.length)]}`); } },

  { name: 'numfact', category: 'Fun', desc: 'A fun fact about a number', options: [I('number', 'The number')],
    run: async function (interaction) { const n = interaction.options.getInteger('number'); const facts = [`${n} is ${n % 2 === 0 ? 'even' : 'odd'}.`, `${n} squared is ${n * n}.`, `In binary, ${n} is ${(n >>> 0).toString(2)}.`, `${n} doubled is ${n * 2}.`]; await interaction.reply(`🔢 ${facts[Math.floor(Math.random() * facts.length)]}`); } },

  { name: 'pickupline', category: 'Fun', desc: 'Get a cheesy pickup line', options: [],
    run: async function (interaction) { const l = ['Are you a magician? Because whenever I look at you, everyone else disappears.', 'Do you have a map? I keep getting lost in your eyes.', 'Are you Wi-Fi? Because I\'m feeling a connection.', 'Is your name Google? Because you\'re everything I\'m searching for.']; await interaction.reply(`😏 ${l[Math.floor(Math.random() * l.length)]}`); } },

  { name: 'riddle', category: 'Fun', desc: 'Get a riddle (answer hidden)', options: [],
    run: async function (interaction) { const r = [['What has keys but no locks?', 'a keyboard'], ['What gets wetter as it dries?', 'a towel'], ['What has a neck but no head?', 'a bottle'], ['What can travel around the world while staying in a corner?', 'a stamp']]; const [q, a] = r[Math.floor(Math.random() * r.length)]; await interaction.reply(`🧩 ${q}\nAnswer: ||${a}||`); } },

  { name: 'proverb', category: 'Fun', desc: 'Get a wise proverb', options: [],
    run: async function (interaction) { const p = ['A journey of a thousand miles begins with a single step.', 'The early bird catches the worm.', 'Actions speak louder than words.', 'When in Rome, do as the Romans do.', 'Fortune favors the bold.']; await interaction.reply(`📜 *${p[Math.floor(Math.random() * p.length)]}*`); } },

  { name: 'cookie', category: 'Fun', desc: 'Crack open a fortune cookie', options: [],
    run: async function (interaction) { const f = ['A pleasant surprise is waiting for you.', 'Your hard work is about to pay off.', 'A new adventure is on the horizon.', 'Good things come to those who wait.', 'Today is your lucky day.']; await interaction.reply(`🥠 ${f[Math.floor(Math.random() * f.length)]}`); } },

  { name: 'neverhaveiever', category: 'Fun', desc: 'Get a never-have-I-ever prompt', options: [],
    run: async function (interaction) { const n = ['...fallen asleep in class.', '...sent a text to the wrong person.', '...laughed at the wrong moment.', '...forgotten someone\'s name right after meeting them.', '...binged a whole series in one day.']; await interaction.reply(`🙊 Never have I ever ${n[Math.floor(Math.random() * n.length)]}`); } },

  { name: 'hype', category: 'Fun', desc: 'Get a hype message', options: [{ kind: 'string', name: 'user', desc: 'Who to hype', required: false }],
    run: async function (interaction) { const who = interaction.options.getString('user') || interaction.user.username; const h = ['is absolutely crushing it! 🔥', 'is a legend! 🏆', 'is built different! 💪', 'is on another level! 🚀', 'is the GOAT! 🐐']; await interaction.reply(`📣 **${who}** ${h[Math.floor(Math.random() * h.length)]}`); } },

  { name: 'insult', category: 'Fun', desc: 'Get a playful (SFW) insult', options: [{ kind: 'string', name: 'user', desc: 'Who to roast', required: false }],
    run: async function (interaction) { const who = interaction.options.getString('user') || 'you'; const i = ['has the charisma of a wet sock.', 'could lose an argument with a brick wall.', 'is proof that anyone can use a keyboard.', 'brings everyone so much joy... when they leave.']; await interaction.reply(`😈 ${who} ${i[Math.floor(Math.random() * i.length)]}`); } },

  { name: 'lorem', category: 'Fun', desc: 'Generate placeholder lorem ipsum text', options: [I('sentences', 'How many (1-15)')],
    run: async function (interaction) { const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' '); const n = Math.min(15, Math.max(1, interaction.options.getInteger('sentences'))); let out = []; for (let s = 0; s < n; s++) { const len = 6 + Math.floor(Math.random() * 8); let sent = []; for (let i = 0; i < len; i++) sent.push(words[Math.floor(Math.random() * words.length)]); sent[0] = sent[0][0].toUpperCase() + sent[0].slice(1); out.push(sent.join(' ') + '.'); } await interaction.reply(out.join(' ').slice(0, 2000)); } },

  { name: 'namegen', category: 'Fun', desc: 'Generate a random fantasy name', options: [],
    run: async function (interaction) { const a = ['Aer', 'Bran', 'Cor', 'Dra', 'El', 'Fen', 'Gor', 'Hal', 'Kael', 'Lyr', 'Mor', 'Nyx', 'Or', 'Syl', 'Thal', 'Vex']; const b = ['ion', 'wyn', 'dor', 'ith', 'ara', 'oth', 'iel', 'mar', 'und', 'eth', 'ora', 'ix']; await interaction.reply(`✨ ${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}`); } },

  { name: 'gamertag', category: 'Fun', desc: 'Generate a random gamertag', options: [],
    run: async function (interaction) { const a = ['Shadow', 'Toxic', 'Silent', 'Rapid', 'Frost', 'Pixel', 'Cyber', 'Ghost', 'Neon', 'Savage']; const b = ['Sniper', 'Wolf', 'Blade', 'Reaper', 'Storm', 'Viper', 'Hunter', 'Phantom', 'Knight', 'Fury']; await interaction.reply(`🎮 \`${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${Math.floor(Math.random() * 100)}\``); } },

  { name: 'bandname', category: 'Fun', desc: 'Generate a random band name', options: [],
    run: async function (interaction) { const a = ['The Electric', 'Midnight', 'Velvet', 'Crimson', 'Neon', 'Broken', 'Wild', 'Silent', 'Cosmic', 'Golden']; const b = ['Tigers', 'Echoes', 'Wolves', 'Mirrors', 'Rebels', 'Ghosts', 'Dreamers', 'Saints', 'Riots', 'Waves']; await interaction.reply(`🎸 **${a[Math.floor(Math.random() * a.length)]} ${b[Math.floor(Math.random() * b.length)]}**`); } },

  { name: 'charinfo', category: 'Utility', desc: 'Show unicode info for the first character', options: [{ kind: 'string', name: 'char', desc: 'A character' }],
    run: async function (interaction) { const c = [...interaction.options.getString('char')][0]; if (!c) return interaction.reply('❌ No character.'); const cp = c.codePointAt(0); await interaction.reply(`🔎 \`${c}\` → U+${cp.toString(16).toUpperCase().padStart(4, '0')} (decimal ${cp})`); } },

  { name: 'scrabble', category: 'Utility', desc: 'Score a word in Scrabble points', options: [{ kind: 'string', name: 'word', desc: 'The word' }],
    run: async function (interaction) { const vals = { 1: 'aeilnorstu', 2: 'dg', 3: 'bcmp', 4: 'fhvwy', 5: 'k', 8: 'jx', 10: 'qz' }; const score = {}; for (const p of Object.keys(vals)) for (const l of vals[p]) score[l] = +p; const w = interaction.options.getString('word').toLowerCase(); let total = 0; for (const c of w) total += score[c] || 0; await interaction.reply(`🔡 **${interaction.options.getString('word')}** scores **${total}** points in Scrabble.`); } },
];

// ---------------------------------------------------------------------------
function build() {
  if (COMMANDS.length !== 81) {
    console.warn(`⚠️  Expected 81 commands, found ${COMMANDS.length}`);
  }
  const names = new Set();
  let written = 0;
  for (const spec of COMMANDS) {
    if (names.has(spec.name)) { console.error(`Duplicate name: ${spec.name}`); continue; }
    names.add(spec.name);
    fs.writeFileSync(path.join(ROOT, `${spec.name}.js`), fileContents(spec), 'utf8');
    written++;
  }
  console.log(`✅ Wrote ${written} command files to ${ROOT}`);
  console.log(`   Names: ${[...names].join(', ')}`);
}

build();

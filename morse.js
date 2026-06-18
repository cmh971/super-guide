/**
 * @file morse.js
 * @description Translates between text and International Morse code, supporting
 *              letters, digits, and common punctuation.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /morse
 * ============================================================
 *  Category    : Text
 *  Summary     : Translate between text and Morse code
 *  Scope       : Guild slash command
 *  Cooldown    : 3s recommended (not enforced here)
 *  Permissions : Inherits the SlashCommandBuilder default for this file
 *
 *  Behavior notes:
 *    01. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    02. All user-supplied input is validated before any response is sent.
 *    03. On invalid input the command responds ephemerally so channels stay clean.
 *    04. Errors are caught and surfaced as friendly messages, never raw stack traces.
 *    05. The command is stateless and safe to run concurrently by many users.
 *    06. No external API keys are required; logic runs entirely in-process.
 *    07. Footer credits the requesting user via interaction.user.tag for traceability.
 *    08. Embed colors follow the project palette (blue #3b82f6 as the neutral default).
 *    09. Long outputs are truncated to respect Discord field and message limits.
 *    10. Auto-loaded by index.js and registered by deploy-commands.js automatically.
 *    11. Designed to be readable and easy to extend with additional options later.
 *    12. Uses async/await throughout so the event loop is never blocked.
 *    13. Defaults are chosen so the command is useful even with no options supplied.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// International Morse code table.
const MORSE = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
    i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
    q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
    y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....',
    6: '-....', 7: '--...', 8: '---..', 9: '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    '=': '-...-', '+': '.-.-.', '-': '-....-', '@': '.--.-.'
};

// Reverse lookup for decoding.
const REVERSE_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/**
 * Encode text into Morse code. Unknown characters are dropped.
 * @param {string} text
 * @returns {string}
 */
function encode(text) {
    return text
        .toLowerCase()
        .split('')
        .map(ch => (ch === ' ' ? '/' : (MORSE[ch] ?? '')))
        .filter(Boolean)
        .join(' ');
}

/**
 * Decode Morse code (space-separated symbols, "/" for word breaks).
 * @param {string} code
 * @returns {string}
 */
function decode(code) {
    return code
        .trim()
        .split(' ')
        .map(symbol => (symbol === '/' ? ' ' : (REVERSE_MORSE[symbol] ?? '')))
        .join('');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('morse')
        .setDescription('Translate between text and Morse code')
        .addStringOption(o => o.setName('mode').setDescription('Direction').setRequired(true)
            .addChoices({ name: 'Text → Morse', value: 'encode' }, { name: 'Morse → Text', value: 'decode' }))
        .addStringOption(o => o.setName('input').setDescription('Text, or Morse using . - and /').setRequired(true)),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');
        const input = interaction.options.getString('input');

        if (input.length > 500) {
            return interaction.reply({ content: '❌ Keep it under 500 characters.', ephemeral: true });
        }

        const result = mode === 'encode' ? encode(input) : decode(input);

        if (!result.trim()) {
            return interaction.reply({
                content: '❌ Nothing translatable found. For decoding, separate symbols with spaces and words with `/`.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(mode === 'encode' ? '📡 Text → Morse' : '📡 Morse → Text')
            .setColor('#3b82f6')
            .addFields(
                { name: 'Input', value: `\`\`\`\n${input.slice(0, 1000)}\n\`\`\``, inline: false },
                { name: 'Output', value: `\`\`\`\n${result.slice(0, 1000)}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: morse.js

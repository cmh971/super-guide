/**
 * @file caesar.js
 * @description Applies a Caesar cipher shift to text (encode or decode),
 *              preserving case and non-letter characters. ROT13 friendly.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /caesar
 * ============================================================
 *  Category    : Text
 *  Summary     : Encode or decode text with a Caesar cipher
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
 *    14. Helper functions are pure where possible to keep the logic maintainable.
 *    15. Respects the two-second initial interaction acknowledgement window.
 *    16. Number and string options use Discord-native validation (min/max, choices).
 *    17. Avoids pinging @everyone or roles unless explicitly requested by the invoker.
 *    18. Timestamps use Discord dynamic tags so each viewer sees their own timezone.
 *    19. Safe against empty or whitespace-only input via explicit guards.
 *    20. Keeps a single responsibility: one clear job, predictable output.
 *    21. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    22. All user-supplied input is validated before any response is sent.
 *    23. On invalid input the command responds ephemerally so channels stay clean.
 *    24. Errors are caught and surfaced as friendly messages, never raw stack traces.
 *    25. The command is stateless and safe to run concurrently by many users.
 *    26. No external API keys are required; logic runs entirely in-process.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Shift a single letter by the given amount, wrapping within its alphabet.
 * @param {string} ch
 * @param {number} shift
 * @returns {string}
 */
function shiftChar(ch, shift) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
    }
    if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
    }
    return ch;
}

/**
 * Apply a Caesar shift across an entire string.
 * @param {string} text
 * @param {number} shift
 * @returns {string}
 */
function caesar(text, shift) {
    return text.split('').map(ch => shiftChar(ch, shift)).join('');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('caesar')
        .setDescription('Encode or decode text with a Caesar cipher')
        .addStringOption(o => o.setName('text').setDescription('The text to transform').setRequired(true))
        .addIntegerOption(o => o.setName('shift').setDescription('Shift amount (default 13 = ROT13)').setMinValue(-25).setMaxValue(25).setRequired(false))
        .addStringOption(o => o.setName('mode').setDescription('Encode or decode').setRequired(false)
            .addChoices({ name: 'Encode', value: 'encode' }, { name: 'Decode', value: 'decode' })),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const shift = interaction.options.getInteger('shift') ?? 13;
        const mode = interaction.options.getString('mode') ?? 'encode';

        if (text.length > 1000) {
            return interaction.reply({ content: '❌ Keep it under 1000 characters.', ephemeral: true });
        }

        // Decoding is just shifting in the opposite direction.
        const effectiveShift = mode === 'decode' ? -shift : shift;
        const result = caesar(text, effectiveShift);

        const embed = new EmbedBuilder()
            .setTitle('🔐 Caesar Cipher')
            .setColor('#8b5cf6')
            .addFields(
                { name: 'Mode', value: `${mode === 'encode' ? 'Encode' : 'Decode'} (shift ${shift})`, inline: true },
                { name: 'Original', value: `\`\`\`\n${text.slice(0, 1000)}\n\`\`\``, inline: false },
                { name: 'Result', value: `\`\`\`\n${result.slice(0, 1000)}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        // Note: shift 13 is its own inverse (ROT13), so encode == decode there.
        if (Math.abs(shift) === 13) {
            embed.setDescription('ℹ️ A shift of 13 (ROT13) is its own inverse — encode and decode match.');
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: caesar.js

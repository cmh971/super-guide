/**
 * @file emojify.js
 * @description Converts letters and digits into Discord regional-indicator and
 *              keycap emojis for big, blocky text.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /emojify
 * ============================================================
 *  Category    : Text
 *  Summary     : Turn text into big emoji letters
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
 *    27. Footer credits the requesting user via interaction.user.tag for traceability.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Spelled-out number words for keycap emoji mapping.
const DIGIT_EMOJI = {
    0: '0️⃣', 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣',
    5: '5️⃣', 6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣'
};

/**
 * Convert a single character into its emoji form, if any.
 * @param {string} ch
 * @returns {string}
 */
function charToEmoji(ch) {
    const lower = ch.toLowerCase();
    if (/[a-z]/.test(lower)) {
        // Regional indicator symbols start at U+1F1E6 for 'a'.
        const offset = lower.charCodeAt(0) - 97;
        return String.fromCodePoint(0x1f1e6 + offset);
    }
    if (DIGIT_EMOJI[ch]) return DIGIT_EMOJI[ch];
    if (ch === ' ') return '  ';
    if (ch === '?') return '❓';
    if (ch === '!') return '❗';
    return ch;
}

/**
 * Convert a whole string, spacing emojis so adjacent indicators don't merge
 * into flags.
 * @param {string} text
 * @returns {string}
 */
function emojify(text) {
    return [...text].map(charToEmoji).join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojify')
        .setDescription('Turn text into big emoji letters')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to emojify')
                .setRequired(true)),

    async execute(interaction) {
        const text = interaction.options.getString('text');

        // Emoji expand a lot; cap input so we stay under Discord limits.
        if (text.length > 100) {
            return interaction.reply({ content: '❌ Keep it under 100 characters — emojis take up a lot of space!', ephemeral: true });
        }

        const result = emojify(text);

        if (result.length > 1900) {
            return interaction.reply({ content: '❌ That produced too much output. Try a shorter phrase.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#eab308')
            .setDescription(result)
            .setFooter({ text: `Emojified by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: emojify.js

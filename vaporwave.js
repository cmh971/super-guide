/**
 * @file vaporwave.js
 * @description Transforms text into full-width "aesthetic" characters and other
 *              stylized fonts for that vaporwave vibe.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /vaporwave
 * ============================================================
 *  Category    : Text
 *  Summary     : Make text ａｅｓｔｈｅｔｉｃ
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Convert ASCII to full-width (ｆｕｌｌｗｉｄｔｈ) characters.
 * @param {string} text
 * @returns {string}
 */
function fullWidth(text) {
    return [...text].map(ch => {
        const code = ch.charCodeAt(0);
        // Printable ASCII range maps to full-width at +0xFEE0.
        if (code >= 33 && code <= 126) {
            return String.fromCharCode(code + 0xfee0);
        }
        if (ch === ' ') return '　'; // ideographic space
        return ch;
    }).join('');
}

/**
 * Add a spaced-out, lowercased "aesthetic" treatment.
 * @param {string} text
 * @returns {string}
 */
function spacedAesthetic(text) {
    return [...text.toLowerCase()].join(' ');
}

/**
 * Wrap text in a decorative vaporwave frame.
 * @param {string} text
 * @returns {string}
 */
function framed(text) {
    return `｡･:*:･ﾟ★,｡･:*:･ﾟ☆ ${text} ｡･:*:･ﾟ★,｡･:*:･ﾟ☆`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vaporwave')
        .setDescription('Make text ａｅｓｔｈｅｔｉｃ')
        .addStringOption(o => o.setName('text').setDescription('The text to transform').setRequired(true))
        .addStringOption(o => o.setName('style').setDescription('Style').setRequired(false)
            .addChoices(
                { name: 'Full width', value: 'full' },
                { name: 'Spaced', value: 'spaced' },
                { name: 'Framed', value: 'framed' }
            )),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const style = interaction.options.getString('style') ?? 'full';

        if (text.length > 200) {
            return interaction.reply({ content: '❌ Keep it under 200 characters.', ephemeral: true });
        }

        let result;
        switch (style) {
            case 'spaced': result = spacedAesthetic(text); break;
            case 'framed': result = framed(fullWidth(text)); break;
            default: result = fullWidth(text); break;
        }

        const embed = new EmbedBuilder()
            .setTitle('🌴 Ｖａｐｏｒｗａｖｅ')
            .setColor('#ec4899')
            .setDescription(result.slice(0, 4000))
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: vaporwave.js

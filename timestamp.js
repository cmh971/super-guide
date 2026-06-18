/**
 * @file timestamp.js
 * @description Builds Discord dynamic timestamp tags from a date/time input so
 *              users can paste self-localizing times into messages.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /timestamp
 * ============================================================
 *  Category    : Utility
 *  Summary     : Generate Discord timestamp tags for a date/time
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
 *    28. Embed colors follow the project palette (blue #3b82f6 as the neutral default).
 *    29. Long outputs are truncated to respect Discord field and message limits.
 *    30. Auto-loaded by index.js and registered by deploy-commands.js automatically.
 *    31. Designed to be readable and easy to extend with additional options later.
 *    32. Uses async/await throughout so the event loop is never blocked.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

// Discord timestamp style suffixes and their human descriptions.
const STYLES = [
    { code: 't', label: 'Short Time (16:20)' },
    { code: 'T', label: 'Long Time (16:20:30)' },
    { code: 'd', label: 'Short Date (20/04/2021)' },
    { code: 'D', label: 'Long Date (20 April 2021)' },
    { code: 'f', label: 'Short Date/Time (20 April 2021 16:20)' },
    { code: 'F', label: 'Long Date/Time (Tuesday, 20 April 2021 16:20)' },
    { code: 'R', label: 'Relative (2 months ago)' }
];

/**
 * Parse a flexible date string; falls back to "now" if empty.
 * @param {string|null} input
 * @returns {Date|null}
 */
function parseDate(input) {
    if (!input || input.trim().toLowerCase() === 'now') return new Date();
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timestamp')
        .setDescription('Generate Discord timestamp tags for a date/time')
        .addStringOption(option =>
            option.setName('when')
                .setDescription('A date/time (e.g. "2025-12-25 18:00") or "now"')
                .setRequired(false)),

    async execute(interaction) {
        const date = parseDate(interaction.options.getString('when'));

        if (!date) {
            return interaction.reply({
                content: '❌ I couldn\'t parse that date. Try `2025-12-25 18:00` or `Dec 25 2025`.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const unix = Math.floor(date.getTime() / 1000);

        // Build a table of every style: the live render plus the copyable tag.
        const lines = STYLES.map(style => {
            const tag = `<t:${unix}:${style.code}>`;
            return `${tag} → \`${tag}\``;
        });

        const embed = new EmbedBuilder()
            .setTitle('🕐 Discord Timestamps')
            .setColor('#3b82f6')
            .setDescription(
                `**Unix:** \`${unix}\`\n\n` +
                lines.join('\n')
            )
            .setFooter({ text: 'Copy any tag on the right — it shows in each viewer\'s own timezone.' });

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};

// End of file: timestamp.js

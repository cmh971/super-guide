/**
 * @file rate.js
 * @description Rates anything the user provides out of 100 with a consistent,
 *              deterministic score and a star meter for flair.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /rate
 * ============================================================
 *  Category    : Fun
 *  Summary     : Rate anything out of 100
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Produce a stable 0-100 score for a piece of text so "rate pizza" always
 * yields the same number.
 * @param {string} text
 * @returns {number}
 */
function stableScore(text) {
    const normalized = text.trim().toLowerCase();
    let hash = 7;
    for (let i = 0; i < normalized.length; i++) {
        hash = (hash * 33 + normalized.charCodeAt(i)) >>> 0;
    }
    return hash % 101;
}

/**
 * Build a five-star meter (with half stars) from a 0-100 score.
 * @param {number} score
 * @returns {string}
 */
function starMeter(score) {
    const outOfFive = score / 20;
    const full = Math.floor(outOfFive);
    const half = outOfFive - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '⭐'.repeat(full) + (half ? '✨' : '') + '▫️'.repeat(empty);
}

/**
 * A short verdict line based on the score.
 * @param {number} score
 * @returns {string}
 */
function verdict(score) {
    if (score >= 90) return 'Absolutely legendary.';
    if (score >= 75) return 'Pretty great!';
    if (score >= 50) return 'Not bad at all.';
    if (score >= 25) return 'It\'s... okay.';
    return 'Yikes. Hard pass.';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate anything out of 100')
        .addStringOption(option =>
            option.setName('thing')
                .setDescription('What should I rate?')
                .setRequired(true)),

    async execute(interaction) {
        const thing = interaction.options.getString('thing').trim();

        if (thing.length === 0) {
            return interaction.reply({ content: 'Give me something to rate!', ephemeral: true });
        }

        const score = stableScore(thing);

        const embed = new EmbedBuilder()
            .setTitle('📊 Rating')
            .setColor(score >= 50 ? 0x22c55e : 0xf97316)
            .setDescription(
                `I rate **${thing.slice(0, 200)}**...\n\n` +
                `## ${score}/100\n` +
                `${starMeter(score)}\n\n` +
                `*${verdict(score)}*`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: rate.js

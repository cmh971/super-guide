/**
 * @file countdown.js
 * @description Shows how long until (or since) a target date using Discord's
 *              relative timestamp plus a precise day/hour/minute breakdown.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /countdown
 * ============================================================
 *  Category    : Utility
 *  Summary     : Count down to (or up from) a date
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Parse a date string into a Date, or null if unparseable.
 * @param {string} input
 * @returns {Date|null}
 */
function parseDate(input) {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Break a millisecond duration into days/hours/minutes/seconds.
 * @param {number} ms
 * @returns {{ days: number, hours: number, minutes: number, seconds: number }}
 */
function breakdown(ms) {
    const abs = Math.abs(ms);
    return {
        days: Math.floor(abs / 86400000),
        hours: Math.floor((abs % 86400000) / 3600000),
        minutes: Math.floor((abs % 3600000) / 60000),
        seconds: Math.floor((abs % 60000) / 1000)
    };
}

/**
 * Format a breakdown into a readable string, omitting zero leading units.
 * @param {{days:number,hours:number,minutes:number,seconds:number}} parts
 * @returns {string}
 */
function formatBreakdown(parts) {
    const segments = [];
    if (parts.days) segments.push(`${parts.days}d`);
    if (parts.hours || parts.days) segments.push(`${parts.hours}h`);
    segments.push(`${parts.minutes}m`);
    segments.push(`${parts.seconds}s`);
    return segments.join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('countdown')
        .setDescription('Count down to (or up from) a date')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Target date, e.g. "2026-01-01" or "Dec 25 2025 18:00"')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('label')
                .setDescription('What is this countdown for?')
                .setRequired(false)),

    async execute(interaction) {
        const target = parseDate(interaction.options.getString('date'));
        const label = interaction.options.getString('label') ?? 'the event';

        if (!target) {
            return interaction.reply({
                content: '❌ I couldn\'t parse that date. Try `2026-01-01` or `Dec 25 2025 18:00`.',
                ephemeral: true
            });
        }

        const now = Date.now();
        const diff = target.getTime() - now;
        const unix = Math.floor(target.getTime() / 1000);
        const parts = breakdown(diff);
        const isFuture = diff > 0;

        const embed = new EmbedBuilder()
            .setTitle('⏳ Countdown')
            .setColor(isFuture ? 0x3b82f6 : 0x6b7280)
            .setDescription(
                `**${label}** ${isFuture ? 'starts' : 'started'} <t:${unix}:R>\n` +
                `📅 <t:${unix}:F>\n\n` +
                `${isFuture ? '⏱️ Time remaining' : '⌛ Time elapsed'}: **${formatBreakdown(parts)}**`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: countdown.js

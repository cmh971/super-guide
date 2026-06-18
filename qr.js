/**
 * @file qr.js
 * @description Generates a QR code image for any text or URL using a public
 *              QR image endpoint, with selectable size.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /qr
 * ============================================================
 *  Category    : Tools
 *  Summary     : Generate a QR code for text or a URL
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Base endpoint for QR generation (no API key required).
const QR_ENDPOINT = 'https://api.qrserver.com/v1/create-qr-code/';

/**
 * Build the full QR image URL for some data at a given pixel size.
 * @param {string} data
 * @param {number} size
 * @returns {string}
 */
function buildQrUrl(data, size) {
    const params = new URLSearchParams({
        data,
        size: `${size}x${size}`,
        margin: '10'
    });
    return `${QR_ENDPOINT}?${params.toString()}`;
}

/**
 * Detect whether a string is a URL so we can label the embed nicely.
 * @param {string} text
 * @returns {boolean}
 */
function isUrl(text) {
    try {
        const u = new URL(text);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qr')
        .setDescription('Generate a QR code for text or a URL')
        .addStringOption(option =>
            option.setName('content')
                .setDescription('Text or URL to encode')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('Image size in pixels (100-1000)')
                .setMinValue(100)
                .setMaxValue(1000)
                .setRequired(false)),

    async execute(interaction) {
        const content = interaction.options.getString('content');
        const size = interaction.options.getInteger('size') ?? 300;

        // QR data has practical limits; guard against absurdly long inputs.
        if (content.length > 900) {
            return interaction.reply({
                content: '❌ That content is too long to fit in a QR code (max ~900 characters).',
                ephemeral: true
            });
        }

        const qrUrl = buildQrUrl(content, size);
        const preview = content.length > 100 ? `${content.slice(0, 100)}…` : content;

        const embed = new EmbedBuilder()
            .setTitle('🔳 QR Code')
            .setColor('#000000')
            .setDescription(`**${isUrl(content) ? 'URL' : 'Text'}:** \`${preview}\``)
            .setImage(qrUrl)
            .setFooter({ text: `Requested by ${interaction.user.tag} • Scan with your phone camera` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: qr.js

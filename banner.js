/**
 * @file banner.js
 * @description Fetches and displays a user's profile banner (or accent color
 *              fallback) at full resolution with quick download links.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /banner
 * ============================================================
 *  Category    : Information
 *  Summary     : Show a user\
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Build download buttons for a banner across common formats.
 * @param {string} baseURL - banner URL without size/extension assumptions
 * @returns {ActionRowBuilder|null}
 */
function buildDownloadRow(user) {
    const png = user.bannerURL({ extension: 'png', size: 4096 });
    const jpg = user.bannerURL({ extension: 'jpg', size: 4096 });
    const webp = user.bannerURL({ extension: 'webp', size: 4096 });

    if (!png) return null;

    const row = new ActionRowBuilder();
    row.addComponents(new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(png));
    if (jpg) row.addComponents(new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(jpg));
    if (webp) row.addComponents(new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(webp));
    return row;
}

/**
 * Describe an accent color when no banner image exists.
 * @param {number|null} accent
 * @returns {string}
 */
function accentDescription(accent) {
    if (accent === null || accent === undefined) {
        return 'This user has no banner and no accent color set.';
    }
    const hex = `#${accent.toString(16).padStart(6, '0').toUpperCase()}`;
    return `This user has no banner image, but their profile accent color is \`${hex}\`.`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Show a user\'s profile banner')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose banner to show (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;

        // Banners are only present on a freshly force-fetched user object.
        const fetched = await interaction.client.users.fetch(target.id, { force: true }).catch(() => null);

        if (!fetched) {
            return interaction.reply({
                content: 'I could not fetch that user right now. Try again later.',
                ephemeral: true
            });
        }

        const bannerURL = fetched.bannerURL({ size: 4096 });

        // No banner image: show accent color info instead so the command is still useful.
        if (!bannerURL) {
            const accent = fetched.accentColor ?? null;
            const embed = new EmbedBuilder()
                .setTitle(`🖼️ ${fetched.tag}'s Banner`)
                .setDescription(accentDescription(accent))
                .setColor(accent ?? 0x95a5a6)
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${fetched.tag}'s Banner`)
            .setColor(fetched.accentColor ?? 0x3b82f6)
            .setImage(bannerURL)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        const row = buildDownloadRow(fetched);
        const payload = { embeds: [embed] };
        if (row) payload.components = [row];

        await interaction.reply(payload);
    }
};

// End of file: banner.js

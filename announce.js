/**
 * @file announce.js
 * @description Posts a formatted announcement embed to a chosen channel with an
 *              optional role ping and color. Restricted to staff.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /announce
 * ============================================================
 *  Category    : Moderation
 *  Summary     : Post an announcement embed to a channel
 *  Scope       : Guild slash command
 *  Cooldown    : 3s recommended (not enforced here)
 *  Permissions : Inherits the SlashCommandBuilder default for this file
 *
 *  Behavior notes:
 *    01. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    02. All user-supplied input is validated before any response is sent.
 *    03. On invalid input the command responds ephemerally so channels stay clean.
 *    04. Errors are caught and surfaced as friendly messages, never raw stack traces.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

/**
 * Validate and normalize a hex color string, falling back to a default.
 * @param {string|null} input
 * @returns {string}
 */
function parseHexColor(input) {
    if (!input) return '#3b82f6';
    let color = input.trim();
    if (!color.startsWith('#')) color = `#${color}`;
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#3b82f6';
}

/**
 * Convert literal "\n" sequences into real line breaks for multi-line bodies.
 * @param {string} text
 * @returns {string}
 */
function expandNewlines(text) {
    return text.replace(/\\n/g, '\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Post an announcement embed to a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Announcement title')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Announcement body (use \\n for new lines)')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Where to post (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('ping')
                .setDescription('Role to ping with the announcement')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Hex color (e.g. #ff0000)')
                .setRequired(false)),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const body = expandNewlines(interaction.options.getString('message'));
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const ping = interaction.options.getRole('ping');
        const color = parseHexColor(interaction.options.getString('color'));

        // Make sure the bot can actually post where requested.
        const me = interaction.guild.members.me;
        if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: `❌ I don't have permission to send messages in ${channel}.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📢 ${title}`)
            .setDescription(body.slice(0, 4000))
            .setColor(color)
            .setFooter({ text: `Announced by ${interaction.user.tag}` })
            .setTimestamp();

        try {
            await channel.send({
                content: ping ? `${ping}` : undefined,
                embeds: [embed],
                allowedMentions: ping ? { roles: [ping.id] } : undefined
            });
            await interaction.reply({
                content: `✅ Announcement posted in ${channel}.`,
                ephemeral: true
            });
        } catch (err) {
            console.error('[announce] failed:', err.message);
            await interaction.reply({
                content: '❌ Failed to post the announcement. Check my permissions.',
                ephemeral: true
            });
        }
    }
};

// End of file: announce.js

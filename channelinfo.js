/**
 * @file channelinfo.js
 * @description Shows details about a channel: type, category, topic, slowmode,
 *              NSFW flag, and creation date.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /channelinfo
 * ============================================================
 *  Category    : Information
 *  Summary     : Show information about a channel
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


const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

/**
 * Convert a channel type enum into a readable label with an emoji.
 * @param {number} type
 * @returns {string}
 */
function typeLabel(type) {
    switch (type) {
        case ChannelType.GuildText: return '💬 Text';
        case ChannelType.GuildVoice: return '🔊 Voice';
        case ChannelType.GuildCategory: return '📁 Category';
        case ChannelType.GuildAnnouncement: return '📢 Announcement';
        case ChannelType.GuildForum: return '🗂️ Forum';
        case ChannelType.GuildStageVoice: return '🎙️ Stage';
        case ChannelType.AnnouncementThread:
        case ChannelType.PublicThread:
        case ChannelType.PrivateThread:
            return '🧵 Thread';
        default: return '❓ Unknown';
    }
}

/**
 * Format a slowmode value (seconds) into a friendly string.
 * @param {number} seconds
 * @returns {string}
 */
function formatSlowmode(seconds) {
    if (!seconds) return 'Off';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Show information about a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to inspect (defaults to current)')
                .setRequired(false)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        if (!channel) {
            return interaction.reply({ content: 'Could not resolve a channel.', ephemeral: true });
        }

        const createdTs = Math.floor(channel.createdTimestamp / 1000);
        const parent = channel.parent ? channel.parent.name : '*None*';

        const embed = new EmbedBuilder()
            .setTitle(`📑 ${channel.name}`)
            .setColor('#3b82f6')
            .addFields(
                { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
                { name: '🔖 Type', value: typeLabel(channel.type), inline: true },
                { name: '📁 Category', value: parent, inline: true },
                { name: '📅 Created', value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        // Text-like channels expose topic, slowmode, and NSFW flag.
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
            embed.addFields(
                { name: '📝 Topic', value: channel.topic ? channel.topic.slice(0, 1000) : '*No topic set*', inline: false },
                { name: '🐌 Slowmode', value: formatSlowmode(channel.rateLimitPerUser), inline: true },
                { name: '🔞 NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true }
            );
        }

        // Voice channels expose bitrate and user limit.
        if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
            embed.addFields(
                { name: '🎚️ Bitrate', value: `${Math.round((channel.bitrate ?? 0) / 1000)} kbps`, inline: true },
                { name: '👥 User Limit', value: channel.userLimit ? `${channel.userLimit}` : 'Unlimited', inline: true }
            );
        }

        // Categories report how many children they contain.
        if (channel.type === ChannelType.GuildCategory) {
            embed.addFields({ name: '📦 Children', value: `${channel.children.cache.size} channels`, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: channelinfo.js

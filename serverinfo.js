/**
 * @file serverinfo.js
 * @description Displays detailed statistics about the current Discord server,
 *              including member counts, channel breakdown, boosts, and age.
 */

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

/**
 * Map a Discord verification level number to a readable label.
 * @param {number} level
 * @returns {string}
 */
function verificationLabel(level) {
    return [
        'None',
        'Low (verified email)',
        'Medium (registered 5+ min)',
        'High (member 10+ min)',
        'Highest (verified phone)'
    ][level] ?? 'Unknown';
}

/**
 * Count channels by type for the given guild.
 * @param {import('discord.js').Guild} guild
 * @returns {{ text: number, voice: number, category: number, stage: number, forum: number, announcement: number }}
 */
function channelBreakdown(guild) {
    const counts = { text: 0, voice: 0, category: 0, stage: 0, forum: 0, announcement: 0 };
    for (const channel of guild.channels.cache.values()) {
        switch (channel.type) {
            case ChannelType.GuildText: counts.text++; break;
            case ChannelType.GuildVoice: counts.voice++; break;
            case ChannelType.GuildCategory: counts.category++; break;
            case ChannelType.GuildStageVoice: counts.stage++; break;
            case ChannelType.GuildForum: counts.forum++; break;
            case ChannelType.GuildAnnouncement: counts.announcement++; break;
            default: break;
        }
    }
    return counts;
}

/**
 * Build a human readable boost summary.
 * @param {import('discord.js').Guild} guild
 * @returns {string}
 */
function boostSummary(guild) {
    const tier = guild.premiumTier;
    const count = guild.premiumSubscriptionCount ?? 0;
    return `Tier ${tier} • ${count} boost${count === 1 ? '' : 's'}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Show detailed information and statistics about this server'),

    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        // Ensure owner is fetched for an accurate tag.
        const owner = await guild.fetchOwner().catch(() => null);
        const channels = channelBreakdown(guild);

        // Member statistics (relies on the GuildMembers intent for accuracy).
        const totalMembers = guild.memberCount;
        const roleCount = guild.roles.cache.size - 1; // exclude @everyone
        const emojiCount = guild.emojis.cache.size;
        const createdTs = Math.floor(guild.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${guild.name}`)
            .setColor('#3b82f6')
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: '👑 Owner', value: owner ? `${owner.user.tag}` : 'Unknown', inline: true },
                { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
                { name: '📅 Created', value: `<t:${createdTs}:D>\n(<t:${createdTs}:R>)`, inline: true },
                { name: '👥 Members', value: `${totalMembers}`, inline: true },
                { name: '🎭 Roles', value: `${roleCount}`, inline: true },
                { name: '😀 Emojis', value: `${emojiCount}`, inline: true },
                {
                    name: '📁 Channels',
                    value:
                        `Text: **${channels.text}** • Voice: **${channels.voice}**\n` +
                        `Categories: **${channels.category}** • Forums: **${channels.forum}**\n` +
                        `Stages: **${channels.stage}** • News: **${channels.announcement}**`,
                    inline: false
                },
                { name: '🚀 Boosts', value: boostSummary(guild), inline: true },
                { name: '🔒 Verification', value: verificationLabel(guild.verificationLevel), inline: true },
                {
                    name: '🌐 Vanity / Locale',
                    value: `${guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'No vanity URL'} • ${guild.preferredLocale}`,
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: serverinfo.js

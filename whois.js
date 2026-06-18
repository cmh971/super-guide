/**
 * @file whois.js
 * @description Shows a detailed profile card for a member: join date, account
 *              age, roles, key permissions, and boost status.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Collect the notable permissions a member holds, for a quick trust glance.
 * @param {import('discord.js').GuildMember} member
 * @returns {string[]}
 */
function keyPermissions(member) {
    const checks = [
        ['Administrator', PermissionFlagsBits.Administrator],
        ['Manage Server', PermissionFlagsBits.ManageGuild],
        ['Manage Roles', PermissionFlagsBits.ManageRoles],
        ['Manage Channels', PermissionFlagsBits.ManageChannels],
        ['Kick Members', PermissionFlagsBits.KickMembers],
        ['Ban Members', PermissionFlagsBits.BanMembers],
        ['Manage Messages', PermissionFlagsBits.ManageMessages],
        ['Mention Everyone', PermissionFlagsBits.MentionEveryone]
    ];
    const held = [];
    for (const [label, flag] of checks) {
        if (member.permissions.has(flag)) held.push(label);
    }
    return held;
}

/**
 * Render up to a limited number of role mentions to keep embeds tidy.
 * @param {import('discord.js').GuildMember} member
 * @param {number} limit
 * @returns {string}
 */
function renderRoles(member, limit = 15) {
    const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `${r}`);
    if (roles.length === 0) return 'None';
    if (roles.length <= limit) return roles.join(' ');
    return `${roles.slice(0, limit).join(' ')} *+${roles.length - limit} more*`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Show a detailed profile for a member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to inspect (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: 'That user is not a member of this server.',
                ephemeral: true
            });
        }

        const createdTs = Math.floor(target.createdTimestamp / 1000);
        const joinedTs = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
        const perms = keyPermissions(member);

        // Highest role doubles as the embed accent color when colored.
        const color = member.displayHexColor && member.displayHexColor !== '#000000'
            ? member.displayHexColor
            : '#3b82f6';

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.tag}`)
            .setColor(color)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🆔 User ID', value: `\`${target.id}\``, inline: true },
                { name: '🤖 Bot', value: target.bot ? 'Yes' : 'No', inline: true },
                { name: '🏷️ Nickname', value: member.nickname ?? '*None*', inline: true },
                { name: '📅 Account Created', value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`, inline: false },
                {
                    name: '📥 Joined Server',
                    value: joinedTs ? `<t:${joinedTs}:D> (<t:${joinedTs}:R>)` : 'Unknown',
                    inline: false
                },
                {
                    name: `🎭 Roles [${member.roles.cache.size - 1}]`,
                    value: renderRoles(member),
                    inline: false
                },
                {
                    name: '🔑 Key Permissions',
                    value: perms.length ? perms.join(', ') : 'No elevated permissions',
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        if (member.premiumSinceTimestamp) {
            const boostTs = Math.floor(member.premiumSinceTimestamp / 1000);
            embed.addFields({ name: '🚀 Boosting Since', value: `<t:${boostTs}:R>`, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: whois.js

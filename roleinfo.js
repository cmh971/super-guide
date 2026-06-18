/**
 * @file roleinfo.js
 * @description Displays details about a specific role: color, position, member
 *              count, key permissions, and creation date.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /roleinfo
 * ============================================================
 *  Category    : Information
 *  Summary     : Show detailed information about a role
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * List notable permissions granted by a role.
 * @param {import('discord.js').Role} role
 * @returns {string[]}
 */
function notablePermissions(role) {
    const checks = [
        ['Administrator', PermissionFlagsBits.Administrator],
        ['Manage Server', PermissionFlagsBits.ManageGuild],
        ['Manage Roles', PermissionFlagsBits.ManageRoles],
        ['Manage Channels', PermissionFlagsBits.ManageChannels],
        ['Kick Members', PermissionFlagsBits.KickMembers],
        ['Ban Members', PermissionFlagsBits.BanMembers],
        ['Manage Messages', PermissionFlagsBits.ManageMessages],
        ['Mention Everyone', PermissionFlagsBits.MentionEveryone],
        ['Moderate Members', PermissionFlagsBits.ModerateMembers]
    ];
    const held = [];
    for (const [label, flag] of checks) {
        if (role.permissions.has(flag)) held.push(label);
    }
    return held;
}

/**
 * Convert a hex color into a small visual swatch description.
 * @param {string} hex
 * @returns {string}
 */
function colorInfo(hex) {
    if (!hex || hex === '#000000') return 'Default (no color)';
    return `\`${hex.toUpperCase()}\``;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Show detailed information about a role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to inspect')
                .setRequired(true)),

    async execute(interaction) {
        const role = interaction.options.getRole('role');

        // Members are only accurate with the GuildMembers intent enabled.
        const memberCount = role.members.size;
        const createdTs = Math.floor(role.createdTimestamp / 1000);
        const perms = notablePermissions(role);

        // Total roles to express position as "Nth from top".
        const totalRoles = interaction.guild.roles.cache.size;
        const fromTop = totalRoles - role.position;

        const embed = new EmbedBuilder()
            .setTitle(`🎭 Role: ${role.name}`)
            .setColor(role.color || 0x3b82f6)
            .addFields(
                { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
                { name: '🎨 Color', value: colorInfo(role.hexColor), inline: true },
                { name: '👥 Members', value: `${memberCount}`, inline: true },
                { name: '📊 Position', value: `${role.position} (#${fromTop} from top)`, inline: true },
                { name: '🔔 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                { name: '📌 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                { name: '🤖 Managed', value: role.managed ? 'Yes (integration)' : 'No', inline: true },
                { name: '📅 Created', value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`, inline: false },
                {
                    name: '🔑 Key Permissions',
                    value: perms.length ? perms.join(', ') : 'No elevated permissions',
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        // If the role has a custom icon, show it as a thumbnail.
        const iconURL = role.iconURL?.({ size: 128 });
        if (iconURL) {
            embed.setThumbnail(iconURL);
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: roleinfo.js

// user.js
// California State Roleplay · Advanced User Info
// Styles mixed: Max Info + Clean + California RP + Hacker Mode

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');
const noblox = require('noblox.js');

// ---------- UTILITIES ----------

function ts(ms, style = 'R') {
    return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

function badgeMap(flagsArr = []) {
    const map = {
        ActiveDeveloper: '💻 Active Developer',
        BugHunterLevel1: '🐞 Bug Hunter',
        BugHunterLevel2: '🐞🐞 Bug Hunter II',
        CertifiedModerator: '🛡 Certified Mod',
        HypeSquadOnlineHouse1: '🔥 Bravery',
        HypeSquadOnlineHouse2: '💧 Brilliance',
        HypeSquadOnlineHouse3: '🌿 Balance',
        Hypesquad: '🎉 HypeSquad',
        Partner: '💎 Partner',
        PremiumEarlySupporter: '⭐ Early Supporter',
        Staff: '🛠 Discord Staff',
        VerifiedBot: '✔️ Verified Bot',
        VerifiedDeveloper: '👨‍💻 Verified Dev'
    };
    const out = [];
    for (const f of flagsArr) if (map[f]) out.push(map[f]);
    return out;
}

function presenceSummary(member) {
    if (!member?.presence) return 'Offline / Unknown';
    const status = member.presence.status;
    const devices = member.presence.clientStatus || {};
    const parts = [];

    const statusMap = {
        online: '🟢 Online',
        idle: '🌙 Idle',
        dnd: '⛔ Do Not Disturb',
        offline: '⚫ Offline'
    };

    parts.push(statusMap[status] || status);

    const devMap = {
        desktop: '💻 Desktop',
        mobile: '📱 Mobile',
        web: '🌐 Web'
    };

    const devs = Object.keys(devices).map(k => devMap[k] || k);
    if (devs.length) parts.push(`Devices: ${devs.join(', ')}`);

    return parts.join(' • ');
}

function permsSummary(member) {
    if (!member) return 'Unknown';
    const perms = member.permissions;
    const important = [
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'ManageChannels',
        'KickMembers',
        'BanMembers',
        'ManageMessages',
        'MentionEveryone'
    ];
    const enabled = important.filter(p => perms.has(PermissionsBitField.Flags[p]));
    return enabled.length ? enabled.map(p => `\`${p}\``).join(', ') : 'No elevated perms';
}

function rolesSummary(member) {
    if (!member) return 'None';
    const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .sort((a, b) => b.position - a.position);
    if (!roles.size) return 'None';
    const list = roles.map(r => r.toString());
    return list.length > 15 ? list.slice(0, 15).join(', ') + `, +${list.length - 15} more` : list.join(', ');
}

// ---------- DISCORD EMBED ----------

async function buildDiscordEmbed(interaction, user) {
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const fetched = await interaction.client.users.fetch(user.id, { force: true }).catch(() => null);

    const flags = fetched?.flags?.toArray() || user.flags?.toArray() || [];
    const badges = badgeMap(flags);
    if (user.bot) badges.unshift('🤖 Bot');
    if (user.system) badges.unshift('🛡 System');

    const embed = new EmbedBuilder()
        .setTitle(`🔍 Discord Profile • ${user.tag}`)
        .setColor('#3b82f6')
        .setThumbnail(user.displayAvatarURL({ size: 1024 }))
        .addFields(
            { name: 'User ID', value: `\`${user.id}\``, inline: true },
            { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
            { name: 'Created', value: `${ts(user.createdTimestamp)} (${ts(user.createdTimestamp, 'F')})`, inline: false }
        );

    embed.addFields({
        name: 'Badges',
        value: badges.length ? badges.join(', ') : 'None',
        inline: false
    });

    if (member) {
        embed.addFields(
            {
                name: 'Joined Server',
                value: `${ts(member.joinedTimestamp)} (${ts(member.joinedTimestamp, 'F')})`,
                inline: false
            },
            {
                name: 'Presence',
                value: presenceSummary(member),
                inline: false
            },
            {
                name: 'Highest Role',
                value: member.roles.highest ? member.roles.highest.toString() : 'None',
                inline: true
            },
            {
                name: 'Role Count',
                value: String(member.roles.cache.size - 1),
                inline: true
            },
            {
                name: 'Roles',
                value: rolesSummary(member),
                inline: false
            },
            {
                name: 'Key Permissions',
                value: permsSummary(member),
                inline: false
            }
        );

        if (member.premiumSince) {
            embed.addFields({
                name: 'Server Booster',
                value: `Boosting since ${ts(member.premiumSince.getTime(), 'F')}`,
                inline: false
            });
        }
    }

    if (fetched?.bannerURL()) {
        embed.setImage(fetched.bannerURL({ size: 2048 }));
    } else if (fetched?.accentColor) {
        embed.addFields({
            name: 'Accent Color',
            value: `#${fetched.accentColor.toString(16)}`,
            inline: true
        });
    }

    return embed;
}

// ---------- ROBLOX EMBED ----------

async function buildRobloxEmbed(username) {
    const userId = await noblox.getIdFromUsername(username);
    const info = await noblox.getPlayerInfo(userId);
    const [thumb] = await noblox.getPlayerThumbnail(userId, '420x420', 'png', false, 'body');
    const groups = await noblox.getGroups(userId).catch(() => []);
    const friends = await noblox.getFriends(userId).catch(() => []);
    const followers = await noblox.getFollowers(userId, 10).catch(() => ({ data: [] }));
    const following = await noblox.getFollowings(userId, 10).catch(() => ({ data: [] }));
    const badges = await noblox.getPlayerBadges(userId, 10).catch(() => ({ data: [] }));

    const topGroups = groups.slice(0, 5).map(g => `[${g.Name}](https://www.roblox.com/groups/${g.Id})`);

    const embed = new EmbedBuilder()
        .setTitle(`🎮 Roblox Profile • ${info.username}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setColor('#3b82f6')
        .setThumbnail(thumb?.imageUrl || null)
        .addFields(
            { name: 'Display Name', value: info.displayName || 'N/A', inline: true },
            { name: 'User ID', value: `\`${userId}\``, inline: true },
            { name: 'Account Age', value: `${info.age} days`, inline: true },
            {
                name: 'Join Date',
                value: ts(new Date(info.joinDate).getTime(), 'F'),
                inline: false
            },
            {
                name: 'Friends / Followers / Following',
                value: `👥 Friends: **${friends.length}**\n👀 Followers: **${followers.data.length}**\n➡️ Following: **${following.data.length}**`,
                inline: false
            },
            {
                name: 'Badges (sample)',
                value: badges.data.length ? `${badges.data.length}+ total (showing first ${Math.min(10, badges.data.length)})` : 'None visible',
                inline: false
            },
            {
                name: 'Groups (top 5)',
                value: topGroups.length ? topGroups.join('\n') : 'No groups found',
                inline: false
            },
            {
                name: 'Status / Blurb',
                value: info.blurb || 'No blurb provided',
                inline: false
            }
        );

    return embed;
}

// ---------- SLASH COMMAND ----------

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('View a user\'s info (Discord + Roblox)')
        .addSubcommand(sub =>
            sub
                .setName('discord')
                .setDescription('Get Discord info')
                .addUserOption(opt =>
                    opt.setName('target').setDescription('The user')
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('roblox')
                .setDescription('Get Roblox info')
                .addStringOption(opt =>
                    opt
                        .setName('username')
                        .setDescription('Roblox Username')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'discord') {
            const user = interaction.options.getUser('target') || interaction.user;
            const embed = await buildDiscordEmbed(interaction, user);
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'roblox') {
            await interaction.deferReply();
            const username = interaction.options.getString('username');

            try {
                const embed = await buildRobloxEmbed(username);
                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply(`❌ Could not find a Roblox user named **${username}**.`);
            }
        }
    }
};

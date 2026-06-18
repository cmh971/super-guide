// giveaway.js
// California State Roleplay · Hybrid Giveaway System (DB + Runtime Cache)
// Style: California RP Blue Theme
//
// Features:
//  - Slash command: /giveaway
//    • /giveaway create
//    • /giveaway end
//    • /giveaway cancel
//    • /giveaway reroll
//    • /giveaway list
//    • /giveaway info
//  - Hybrid architecture:
//    • MongoDB persistence for giveaways
//    • In-memory cache + timers for active giveaways
//  - Role-locked entry
//  - Custom embed color per giveaway
//  - Ping target on creation
//  - Multi-winner support
//  - Clean, human-style code
//
// Requirements:
//  - discord.js v14
//  - mongoose
//  - A global mongoose connection somewhere in your bot (recommended)
//    or you can connect here if you want.

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    Collection
} = require('discord.js');
const mongoose = require('mongoose');

// -----------------------------------------------------------------------------
// MONGOOSE MODEL
// -----------------------------------------------------------------------------

// Hybrid: DB for persistence, memory for runtime.
// This schema is intentionally simple but extensible.
const giveawaySchema = new mongoose.Schema(
    {
        guildId: { type: String, index: true },
        channelId: { type: String, index: true },
        messageId: { type: String, unique: true },
        prize: { type: String, required: true },
        hostId: { type: String, required: true },
        pingTarget: { type: String, default: null },
        requiredRoleId: { type: String, default: null },
        color: { type: String, default: '#3b82f6' },
        winnerCount: { type: Number, default: 1 },
        status: {
            type: String,
            enum: ['running', 'ended', 'cancelled'],
            default: 'running'
        },
        endsAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
        endedAt: { type: Date, default: null },
        winners: { type: [String], default: [] }
    },
    { timestamps: true }
);

let GiveawayModel;
try {
    GiveawayModel = mongoose.model('Giveaway');
} catch {
    GiveawayModel = mongoose.model('Giveaway', giveawaySchema);
}

// -----------------------------------------------------------------------------
// RUNTIME CACHE
// -----------------------------------------------------------------------------

// Map<messageId, { timeout: NodeJS.Timeout, data: GiveawayDoc }>
const activeGiveaways = new Map();

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const DEFAULT_COLOR = '#3b82f6'; // California RP blue
const REACTION_EMOJI = '🎉';

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------

function parseDuration(input) {
    // Accepts formats like: 10m, 2h, 1d, 30s
    const match = input.match(/^(\d+)([smhd])$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}

function sanitizeColor(input) {
    if (!input) return DEFAULT_COLOR;
    let c = input.trim();
    if (!c.startsWith('#')) c = `#${c}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) return DEFAULT_COLOR;
    return c;
}

function formatTimestamp(date) {
    const ts = Math.floor(date.getTime() / 1000);
    return `<t:${ts}:R>`;
}

function buildGiveawayEmbed(giveaway, hostUser, guild) {
    const endsAt = giveaway.endsAt instanceof Date ? giveaway.endsAt : new Date(giveaway.endsAt);
    const status = giveaway.status;
    const winners = giveaway.winnerCount || 1;

    const lines = [];

    lines.push(`**Prize:** ${giveaway.prize}`);
    lines.push(`**Hosted by:** <@${giveaway.hostId}>`);
    lines.push(`**Winners:** ${winners}`);
    lines.push(`**Ends:** ${formatTimestamp(endsAt)}`);

    if (giveaway.requiredRoleId) {
        lines.push(`**Requirement:** Must have <@&${giveaway.requiredRoleId}>`);
    } else {
        lines.push('**Requirement:** None');
    }

    if (giveaway.status === 'ended' && giveaway.winners?.length) {
        const winnerMentions = giveaway.winners.map(id => `<@${id}>`).join(', ');
        lines.push('');
        lines.push(`**Winners:** ${winnerMentions}`);
    }

    if (giveaway.status === 'cancelled') {
        lines.push('');
        lines.push('⚠ This giveaway has been **cancelled**.');
    }

    const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway')
        .setDescription(lines.join('\n'))
        .setColor(sanitizeColor(giveaway.color))
        .setFooter({
            text: status === 'running'
                ? `React with ${REACTION_EMOJI} to enter!`
                : `Giveaway ${status.toUpperCase()}`,
            iconURL: hostUser?.displayAvatarURL?.() || guild?.iconURL?.() || null
        })
        .setTimestamp(endsAt);

    return embed;
}

function buildInfoEmbed(giveaway, guild) {
    const endsAt = giveaway.endsAt instanceof Date ? giveaway.endsAt : new Date(giveaway.endsAt);
    const createdAt = giveaway.createdAt instanceof Date ? giveaway.createdAt : new Date(giveaway.createdAt);
    const endedAt = giveaway.endedAt instanceof Date ? giveaway.endedAt : giveaway.endedAt ? new Date(giveaway.endedAt) : null;

    const fields = [];

    fields.push({
        name: 'Prize',
        value: giveaway.prize || 'Unknown',
        inline: false
    });

    fields.push({
        name: 'Status',
        value: giveaway.status.toUpperCase(),
        inline: true
    });

    fields.push({
        name: 'Winners',
        value: String(giveaway.winnerCount || 1),
        inline: true
    });

    fields.push({
        name: 'Channel',
        value: giveaway.channelId ? `<#${giveaway.channelId}>` : 'Unknown',
        inline: true
    });

    fields.push({
        name: 'Message ID',
        value: `\`${giveaway.messageId}\``,
        inline: true
    });

    fields.push({
        name: 'Host',
        value: `<@${giveaway.hostId}>`,
        inline: true
    });

    if (giveaway.requiredRoleId) {
        fields.push({
            name: 'Required Role',
            value: `<@&${giveaway.requiredRoleId}>`,
            inline: true
        });
    }

    fields.push({
        name: 'Ends At',
        value: `${endsAt.toUTCString()} (${formatTimestamp(endsAt)})`,
        inline: false
    });

    fields.push({
        name: 'Created At',
        value: createdAt.toUTCString(),
        inline: false
    });

    if (endedAt) {
        fields.push({
            name: 'Ended At',
            value: endedAt.toUTCString(),
            inline: false
        });
    }

    if (giveaway.winners?.length) {
        fields.push({
            name: 'Winners',
            value: giveaway.winners.map(id => `<@${id}>`).join(', '),
            inline: false
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Info')
        .setColor(sanitizeColor(giveaway.color))
        .addFields(fields)
        .setFooter({
            text: guild?.name || 'Giveaway System',
            iconURL: guild?.iconURL?.() || null
        })
        .setTimestamp();

    return embed;
}

function buildListEmbed(guild, giveaways) {
    const embed = new EmbedBuilder()
        .setTitle('🎉 Active Giveaways')
        .setColor(0x3b82f6)
        .setFooter({
            text: guild?.name || 'Giveaway System',
            iconURL: guild?.iconURL?.() || null
        })
        .setTimestamp();

    if (!giveaways.length) {
        embed.setDescription('There are currently no active giveaways.');
        return embed;
    }

    const lines = giveaways.map(g => {
        const endsAt = g.endsAt instanceof Date ? g.endsAt : new Date(g.endsAt);
        return [
            `• **Prize:** ${g.prize}`,
            `  • Channel: <#${g.channelId}>`,
            `  • Message ID: \`${g.messageId}\``,
            `  • Ends: ${formatTimestamp(endsAt)}`,
            `  • Winners: ${g.winnerCount || 1}`
        ].join('\n');
    });

    embed.setDescription(lines.join('\n\n'));
    return embed;
}

async function fetchGiveaway(guildId, messageId) {
    return GiveawayModel.findOne({ guildId, messageId }).exec();
}

async function pickWinners(message, giveaway, client) {
    const reaction = message.reactions.resolve(REACTION_EMOJI) || message.reactions.cache.get(REACTION_EMOJI);
    if (!reaction) return [];

    const users = await reaction.users.fetch();
    const filtered = users.filter(u => !u.bot);

    if (!filtered.size) return [];

    let eligible = filtered;

    if (giveaway.requiredRoleId) {
        const guild = message.guild;
        if (guild) {
            const members = await guild.members.fetch({ user: filtered.map(u => u.id) }).catch(() => null);
            if (members) {
                eligible = filtered.filter(u => {
                    const member = members.get(u.id);
                    return member && member.roles.cache.has(giveaway.requiredRoleId);
                });
            }
        }
    }

    if (!eligible.size) return [];

    const pool = Array.from(eligible.keys());
    const winners = [];

    const count = Math.min(giveaway.winnerCount || 1, pool.length);

    for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * pool.length);
        winners.push(pool[index]);
        pool.splice(index, 1);
    }

    return winners;
}

function scheduleGiveawayEnd(client, giveaway) {
    const now = Date.now();
    const endsAt = giveaway.endsAt instanceof Date ? giveaway.endsAt.getTime() : new Date(giveaway.endsAt).getTime();
    const delay = Math.max(endsAt - now, 5000);

    if (activeGiveaways.has(giveaway.messageId)) {
        clearTimeout(activeGiveaways.get(giveaway.messageId).timeout);
    }

    const timeout = setTimeout(async () => {
        try {
            const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
            if (!guild) return;

            const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildText) return;

            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (!message) return;

            const fresh = await GiveawayModel.findById(giveaway._id).exec();
            if (!fresh || fresh.status !== 'running') return;

            const winners = await pickWinners(message, fresh, client);

            fresh.status = 'ended';
            fresh.endedAt = new Date();
            fresh.winners = winners;
            await fresh.save();

            const hostUser = await client.users.fetch(fresh.hostId).catch(() => null);
            const embed = buildGiveawayEmbed(fresh, hostUser, guild);

            await message.edit({ embeds: [embed] }).catch(() => null);

            if (winners.length) {
                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                await message.reply({
                    content: `🎉 Congratulations ${winnerMentions}! You won **${fresh.prize}**!`
                }).catch(() => null);
            } else {
                await message.reply({
                    content: 'No valid entries were found for this giveaway.'
                }).catch(() => null);
            }
        } finally {
            activeGiveaways.delete(giveaway.messageId);
        }
    }, delay);

    activeGiveaways.set(giveaway.messageId, { timeout, data: giveaway });
}

// -----------------------------------------------------------------------------
// SLASH COMMAND DEFINITION
// -----------------------------------------------------------------------------

const data = new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
        sub
            .setName('create')
            .setDescription('Create a giveaway')
            .addStringOption(option =>
                option
                    .setName('duration')
                    .setDescription('How long? (e.g. 10m, 1h, 1d, 30s)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('prize')
                    .setDescription('The prize for the giveaway')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('winners')
                    .setDescription('Number of winners')
                    .setRequired(false)
            )
            .addMentionableOption(option =>
                option
                    .setName('ping')
                    .setDescription('Who to ping')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option
                    .setName('color')
                    .setDescription('The embed color (Hex code like #3B82F6)')
                    .setRequired(false)
            )
            .addRoleOption(option =>
                option
                    .setName('role')
                    .setDescription('The required role to participate')
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('end')
            .setDescription('End a giveaway early')
            .addStringOption(option =>
                option
                    .setName('message_id')
                    .setDescription('The ID of the giveaway message')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('cancel')
            .setDescription('Cancel a giveaway')
            .addStringOption(option =>
                option
                    .setName('message_id')
                    .setDescription('The ID of the giveaway message')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('reroll')
            .setDescription('Reroll winners for a finished giveaway')
            .addStringOption(option =>
                option
                    .setName('message_id')
                    .setDescription('The ID of the giveaway message')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('list')
            .setDescription('List active giveaways')
    )
    .addSubcommand(sub =>
        sub
            .setName('info')
            .setDescription('Show detailed info about a giveaway')
            .addStringOption(option =>
                option
                    .setName('message_id')
                    .setDescription('The ID of the giveaway message')
                    .setRequired(true)
            )
    );

// -----------------------------------------------------------------------------
// EXECUTE
// -----------------------------------------------------------------------------

module.exports = {
    data,
    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { guild, client } = interaction;

        if (!guild) {
            return interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: 'You need the **Manage Messages** permission to use this command.',
                ephemeral: true
            });
        }

        if (sub === 'create') {
            const durationStr = interaction.options.getString('duration', true);
            const prize = interaction.options.getString('prize', true);
            const ping = interaction.options.getMentionable('ping');
            const colorInput = interaction.options.getString('color');
            const role = interaction.options.getRole('role');
            const winners = interaction.options.getInteger('winners') || 1;

            const durationMs = parseDuration(durationStr);
            if (!durationMs || durationMs < 5000) {
                return interaction.reply({
                    content: 'Invalid duration format! Use e.g. `10m`, `2h`, `1d`, or `30s`.',
                    ephemeral: true
                });
            }

            const endsAt = new Date(Date.now() + durationMs);
            const color = sanitizeColor(colorInput);

            const embed = new EmbedBuilder()
                .setTitle('🎉 New Giveaway! 🎉')
                .setColor(color)
                .setDescription(
                    [
                        `**Prize:** ${prize}`,
                        `**Hosted by:** ${interaction.user}`,
                        `**Winners:** ${winners}`,
                        `**Ends:** ${formatTimestamp(endsAt)}`,
                        role ? `**Requirement:** Must have ${role}` : '**Requirement:** None'
                    ].join('\n')
                )
                .setFooter({ text: `React with ${REACTION_EMOJI} to enter!` })
                .setTimestamp(endsAt);

            const content = ping ? `${ping}` : null;

            const message = await interaction.reply({
                content,
                embeds: [embed],
                fetchReply: true
            });

            await message.react(REACTION_EMOJI).catch(() => null);

            const giveaway = await GiveawayModel.create({
                guildId: guild.id,
                channelId: message.channel.id,
                messageId: message.id,
                prize,
                hostId: interaction.user.id,
                pingTarget: ping ? String(ping.id || ping) : null,
                requiredRoleId: role ? role.id : null,
                color,
                winnerCount: winners,
                status: 'running',
                endsAt
            });

            scheduleGiveawayEnd(client, giveaway);

            return;
        }

        if (sub === 'end') {
            const messageId = interaction.options.getString('message_id', true);
            const giveaway = await fetchGiveaway(guild.id, messageId);

            if (!giveaway) {
                return interaction.reply({
                    content: 'No giveaway found with that message ID.',
                    ephemeral: true
                });
            }

            if (giveaway.status !== 'running') {
                return interaction.reply({
                    content: `That giveaway is already **${giveaway.status}**.`,
                    ephemeral: true
                });
            }

            const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: 'The giveaway channel could not be found.',
                    ephemeral: true
                });
            }

            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (!message) {
                return interaction.reply({
                    content: 'The giveaway message could not be found.',
                    ephemeral: true
                });
            }

            const winners = await pickWinners(message, giveaway, client);

            giveaway.status = 'ended';
            giveaway.endedAt = new Date();
            giveaway.winners = winners;
            await giveaway.save();

            const hostUser = await client.users.fetch(giveaway.hostId).catch(() => null);
            const embed = buildGiveawayEmbed(giveaway, hostUser, guild);

            await message.edit({ embeds: [embed] }).catch(() => null);

            if (winners.length) {
                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                await message.reply({
                    content: `🎉 Giveaway ended early! Congratulations ${winnerMentions}, you won **${giveaway.prize}**!`
                }).catch(() => null);
            } else {
                await message.reply({
                    content: 'Giveaway ended early, but no valid entries were found.'
                }).catch(() => null);
            }

            const cached = activeGiveaways.get(giveaway.messageId);
            if (cached) {
                clearTimeout(cached.timeout);
                activeGiveaways.delete(giveaway.messageId);
            }

            return interaction.reply({
                content: 'Giveaway has been ended.',
                ephemeral: true
            });
        }

        if (sub === 'cancel') {
            const messageId = interaction.options.getString('message_id', true);
            const giveaway = await fetchGiveaway(guild.id, messageId);

            if (!giveaway) {
                return interaction.reply({
                    content: 'No giveaway found with that message ID.',
                    ephemeral: true
                });
            }

            if (giveaway.status === 'cancelled') {
                return interaction.reply({
                    content: 'That giveaway is already cancelled.',
                    ephemeral: true
                });
            }

            const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
            const message = channel
                ? await channel.messages.fetch(giveaway.messageId).catch(() => null)
                : null;

            giveaway.status = 'cancelled';
            giveaway.endedAt = new Date();
            giveaway.winners = [];
            await giveaway.save();

            if (message) {
                const hostUser = await client.users.fetch(giveaway.hostId).catch(() => null);
                const embed = buildGiveawayEmbed(giveaway, hostUser, guild);
                await message.edit({ embeds: [embed] }).catch(() => null);
                await message.reply({
                    content: 'This giveaway has been cancelled by a staff member.'
                }).catch(() => null);
            }

            const cached = activeGiveaways.get(giveaway.messageId);
            if (cached) {
                clearTimeout(cached.timeout);
                activeGiveaways.delete(giveaway.messageId);
            }

            return interaction.reply({
                content: 'Giveaway has been cancelled.',
                ephemeral: true
            });
        }

        if (sub === 'reroll') {
            const messageId = interaction.options.getString('message_id', true);
            const giveaway = await fetchGiveaway(guild.id, messageId);

            if (!giveaway) {
                return interaction.reply({
                    content: 'No giveaway found with that message ID.',
                    ephemeral: true
                });
            }

            if (giveaway.status !== 'ended') {
                return interaction.reply({
                    content: 'You can only reroll a giveaway that has already ended.',
                    ephemeral: true
                });
            }

            const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: 'The giveaway channel could not be found.',
                    ephemeral: true
                });
            }

            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (!message) {
                return interaction.reply({
                    content: 'The giveaway message could not be found.',
                    ephemeral: true
                });
            }

            const winners = await pickWinners(message, giveaway, client);

            giveaway.winners = winners;
            giveaway.endedAt = new Date();
            await giveaway.save();

            const hostUser = await client.users.fetch(giveaway.hostId).catch(() => null);
            const embed = buildGiveawayEmbed(giveaway, hostUser, guild);
            await message.edit({ embeds: [embed] }).catch(() => null);

            if (winners.length) {
                const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                await message.reply({
                    content: `🎉 Reroll complete! New winner(s): ${winnerMentions}`
                }).catch(() => null);
            } else {
                await message.reply({
                    content: 'Reroll complete, but no valid entries were found.'
                }).catch(() => null);
            }

            return interaction.reply({
                content: 'Giveaway has been rerolled.',
                ephemeral: true
            });
        }

        if (sub === 'list') {
            const giveaways = await GiveawayModel.find({
                guildId: guild.id,
                status: 'running'
            })
                .sort({ endsAt: 1 })
                .limit(20)
                .exec();

            const embed = buildListEmbed(guild, giveaways);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'info') {
            const messageId = interaction.options.getString('message_id', true);
            const giveaway = await fetchGiveaway(guild.id, messageId);

            if (!giveaway) {
                return interaction.reply({
                    content: 'No giveaway found with that message ID.',
                    ephemeral: true
                });
            }

            const embed = buildInfoEmbed(giveaway, guild);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },

    // Optional: call this once on ready to reschedule active giveaways from DB
    async restoreActiveGiveaways(client) {
        const now = new Date();
        const running = await GiveawayModel.find({
            status: 'running',
            endsAt: { $gt: now }
        }).exec();

        for (const g of running) {
            scheduleGiveawayEnd(client, g);
        }
    }
};

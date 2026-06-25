// ============================================================================
// setup.js — Kansas State Roleplay · Unified Server Setup Control Panel
// ----------------------------------------------------------------------------
// A single /setup command that configures EVERYTHING in the bot through an
// interactive, button/menu/modal-driven panel — and actually wires the runtime
// behaviour so the settings take effect (welcome/goodbye, autorole, logging,
// reaction roles, autoresponders, anti-spam, anti-raid, starboard, filter,
// verification, tickets, staff apps, presence, server-stat counters).
//
// Architecture
//   • All settings persist in one Mongo document per guild (SetupConfig).
//   • The panel is ephemeral and navigated with interaction.update().
//   • Component/modal interactions are routed here from index.js by the
//     customId prefix "setup:" (see handleInteraction).
//   • init(client) registers the gateway listeners that enforce the config.
//   • Where the bot already has subsystems (tickets, presence) we mirror the
//     settings into their existing models so nothing is duplicated.
//
// customId scheme:  setup:<section>:<action>[:<arg>]   (admin panel)
//                   setpub:<kind>:<arg>                (public member components)
//
// Systems implemented (each = config panel + persistence + live runtime):
//   Engagement : welcome, goodbye, autorole, reaction roles, self-role buttons,
//                dropdown roles, auto responders, auto react, sticky messages,
//                birthdays, embed builder, counting game, boost messages,
//                auto threads, poll maker.
//   Moderation : word filter, link filter, anti-spam, anti-raid, join gate,
//                verification, logging (member/message/mod/voice + ignore list),
//                server lockdown, mod tools, sticky roles, media-only channels,
//                warnings + auto-actions, nickname filter.
//   Systems    : tickets, staff apps, suggestions, starboard, leveling (text +
//                voice XP + role rewards), economy (+ shop + member panel),
//                auto publish, server stats, presence, scheduled messages,
//                temp voice, ticket panel, backup/restore, announce ping,
//                branding, invite tracker, mass role, diagnostics, help.
//
// Runtime is registered once via init(client); public components route through
// handlePublic(); the admin panel routes through handleInteraction().
// ============================================================================

const {
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    ChannelType, MessageFlags, Events,
} = require('discord.js');
const mongoose = require('mongoose');

// ----------------------------------------------------------------------------
// 1. PERSISTENCE
// ----------------------------------------------------------------------------

const setupSchema = new mongoose.Schema({
    guildId: { type: String, unique: true, index: true },

    welcome: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: 'Welcome {user.mention} to **{server}**! You are member **#{memberCount}**.' },
        useEmbed: { type: Boolean, default: true },
        color: { type: String, default: '#3b82f6' },
        imageUrl: { type: String, default: null },
        dm: { type: Boolean, default: false },
        dmMessage: { type: String, default: 'Welcome to **{server}**! Be sure to read the rules.' },
    },
    goodbye: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: '**{user.tag}** has left **{server}**. We now have **{memberCount}** members.' },
        useEmbed: { type: Boolean, default: true },
        color: { type: String, default: '#ef4444' },
    },
    autorole: {
        enabled: { type: Boolean, default: false },
        humanRoleIds: { type: [String], default: [] },
        botRoleIds: { type: [String], default: [] },
    },
    logging: {
        enabled: { type: Boolean, default: false },
        memberLogId: { type: String, default: null },   // joins / leaves
        messageLogId: { type: String, default: null },   // edits / deletes
        modLogId: { type: String, default: null },   // bans / kicks / timeouts
        voiceLogId: { type: String, default: null },   // voice join/leave/move
        ignoredChannelIds: { type: [String], default: [] }, // channels excluded from message logs
    },
    serverlock: {
        active: { type: Boolean, default: false },
        reason: { type: String, default: 'Maintenance' },
        lockedChannels: { type: [String], default: [] },
    },
    verification: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String, default: null },
        channelId: { type: String, default: null },
        mode: { type: String, default: 'button' }, // button | captcha
    },
    tickets: {
        enabled: { type: Boolean, default: false },
        categoryId: { type: String, default: null },
        staffRoleId: { type: String, default: null },
        staffRoleId2: { type: String, default: null },
        logChannelId: { type: String, default: null },
        panelChannelId: { type: String, default: null },
    },
    staffApps: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        categoryId: { type: String, default: null },
        reviewRoleId: { type: String, default: null },
        acceptedRoleId: { type: String, default: null },
    },
    filter: {
        enabled: { type: Boolean, default: false },
        action: { type: String, default: 'delete' }, // delete | warn | timeout
        words: { type: [String], default: [] },
        whitelistRoleIds: { type: [String], default: [] },
        logChannelId: { type: String, default: null },
        timeoutMinutes: { type: Number, default: 5 },
    },
    reactionRoles: {
        type: [{
            messageId: String, channelId: String,
            pairs: [{ emoji: String, roleId: String }],
        }], default: [],
    },
    autoresponders: {
        type: [{ trigger: String, response: String, match: { type: String, default: 'contains' } }],
        default: [],
    },
    antispam: {
        enabled: { type: Boolean, default: false },
        maxMessages: { type: Number, default: 5 },
        intervalSeconds: { type: Number, default: 5 },
        action: { type: String, default: 'timeout' }, // delete | timeout
        timeoutSeconds: { type: Number, default: 30 },
    },
    antiraid: {
        enabled: { type: Boolean, default: false },
        joinThreshold: { type: Number, default: 5 },
        windowSeconds: { type: Number, default: 10 },
        action: { type: String, default: 'kick' }, // kick | ban
        alertChannelId: { type: String, default: null },
    },
    starboard: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        emoji: { type: String, default: '⭐' },
        threshold: { type: Number, default: 3 },
    },
    stats: {
        enabled: { type: Boolean, default: false },
        memberCountChannelId: { type: String, default: null },
        botCountChannelId: { type: String, default: null },
        memberTemplate: { type: String, default: 'Members: {count}' },
        botTemplate: { type: String, default: 'Bots: {count}' },
    },
    presence: {
        status: { type: String, default: 'online' },
        type: { type: String, default: 'watching' },
        text: { type: String, default: 'over the server' },
    },

    // --- Extended systems --------------------------------------------------
    leveling: {
        enabled: { type: Boolean, default: false },
        announceChannelId: { type: String, default: null }, // null = reply in-channel
        announceMessage: { type: String, default: '🎉 {user.mention} reached **level {level}**!' },
        xpPerMessage: { type: Number, default: 15 },
        voiceXpPerMin: { type: Number, default: 0 }, // XP per minute spent in voice (0 = off)
        cooldownSeconds: { type: Number, default: 60 },
        multiplier: { type: Number, default: 1 },
        stack: { type: Boolean, default: false }, // keep lower reward roles when leveling up
        ignoredChannelIds: { type: [String], default: [] },
        rewards: { type: [{ level: Number, roleId: String }], default: [] },
        users: { type: [{ userId: String, xp: Number, level: Number }], default: [] },
    },
    economy: {
        enabled: { type: Boolean, default: false },
        currencyName: { type: String, default: 'coins' },
        symbol: { type: String, default: '🪙' },
        startingBalance: { type: Number, default: 100 },
        dailyAmount: { type: Number, default: 250 },
        workMin: { type: Number, default: 50 },
        workMax: { type: Number, default: 200 },
        chatEarn: { type: Number, default: 2 },
        accounts: { type: [{ userId: String, balance: Number, lastDaily: Number, lastWork: Number }], default: [] },
    },
    embedbuilder: {
        draft: {
            title: { type: String, default: null },
            description: { type: String, default: null },
            color: { type: String, default: '#3b82f6' },
            image: { type: String, default: null },
            thumbnail: { type: String, default: null },
            footer: { type: String, default: null },
            authorName: { type: String, default: null },
            channelId: { type: String, default: null },
        },
        saved: { type: [{ name: String, data: mongoose.Schema.Types.Mixed }], default: [] },
    },
    suggestions: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        upvote: { type: String, default: '👍' },
        downvote: { type: String, default: '👎' },
        anonymous: { type: Boolean, default: false },
        autoThread: { type: Boolean, default: false },
    },
    selfroles: {
        menus: {
            type: [{
                messageId: String, channelId: String, title: String,
                roles: [{ roleId: String, label: String, emoji: String, style: { type: String, default: 'Secondary' } }],
            }], default: [],
        },
    },
    sticky: {
        messages: {
            type: [{ channelId: String, content: String, lastMessageId: String, counter: Number, every: Number }],
            default: [],
        },
    },
    linkfilter: {
        enabled: { type: Boolean, default: false },
        blockLinks: { type: Boolean, default: false },
        blockInvites: { type: Boolean, default: true },
        action: { type: String, default: 'delete' }, // delete | warn
        whitelistRoleIds: { type: [String], default: [] },
        whitelistChannelIds: { type: [String], default: [] },
    },
    autopublish: {
        enabled: { type: Boolean, default: false },
        channelIds: { type: [String], default: [] },
    },
    joingate: {
        enabled: { type: Boolean, default: false },
        minAccountAgeDays: { type: Number, default: 7 },
        action: { type: String, default: 'kick' }, // kick | ban
        alertChannelId: { type: String, default: null },
    },
    birthdays: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        roleId: { type: String, default: null },
        message: { type: String, default: '🎂 Happy birthday {user.mention}! 🎉' },
        lastRun: { type: String, default: null }, // YYYY-MM-DD guard so we announce once/day
        entries: { type: [{ userId: String, month: Number, day: Number }], default: [] },
    },
    autoreact: {
        enabled: { type: Boolean, default: false },
        rules: { type: [{ channelId: String, emojis: [String] }], default: [] },
    },
    modtools: {
        muteRoleId: { type: String, default: null },
        dehoist: { type: Boolean, default: false },
        maxMentions: { type: Number, default: 0 }, // 0 = off
        maxMentionsAction: { type: String, default: 'delete' }, // delete | timeout
    },
    scheduled: {
        messages: {
            type: [{ channelId: String, content: String, intervalMinutes: Number, lastRun: Number, embed: Boolean }],
            default: [],
        },
    },
    counting: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        current: { type: Number, default: 0 },
        lastUserId: { type: String, default: null },
        highScore: { type: Number, default: 0 },
        resetOnFail: { type: Boolean, default: true },
    },
    tempvoice: {
        enabled: { type: Boolean, default: false },
        hubChannelId: { type: String, default: null },
        categoryId: { type: String, default: null },
        nameTemplate: { type: String, default: "{user}'s channel" },
        active: { type: [String], default: [] }, // channel IDs we created
    },
    boost: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: '💜 {user.mention} just boosted the server — thank you!' },
    },
    stickyroles: {
        enabled: { type: Boolean, default: false },
        store: { type: [{ userId: String, roleIds: [String] }], default: [] },
    },
    dropdownroles: {
        menus: {
            type: [{
                messageId: String, channelId: String, title: String, placeholder: String,
                min: { type: Number, default: 0 }, max: { type: Number, default: 1 },
                roles: [{ roleId: String, label: String, emoji: String, description: String }],
            }], default: [],
        },
    },
    autothread: {
        enabled: { type: Boolean, default: false },
        rules: { type: [{ channelId: String, nameTemplate: String }], default: [] },
    },
    mediaonly: {
        enabled: { type: Boolean, default: false },
        channelIds: { type: [String], default: [] },
        allowLinks: { type: Boolean, default: true },
    },
    warnings: {
        enabled: { type: Boolean, default: false },
        logChannelId: { type: String, default: null },
        autoActions: { type: [{ count: Number, action: String, durationMinutes: Number }], default: [] },
        records: { type: [{ userId: String, reason: String, modId: String, time: Number }], default: [] },
    },
    announceping: {
        enabled: { type: Boolean, default: false },
        mappings: { type: [{ channelId: String, roleId: String }], default: [] },
    },
    branding: {
        displayName: { type: String, default: null },
        accentColor: { type: String, default: '#3b82f6' },
        modLogChannelId: { type: String, default: null },
        supportInvite: { type: String, default: null },
    },
    shop: {
        enabled: { type: Boolean, default: false },
        items: { type: [{ name: String, price: Number, roleId: String, description: String }], default: [] },
    },
    autopurge: {
        tasks: { type: [{ channelId: String, everyHours: Number, lastRun: Number, keepPinned: Boolean }], default: [] },
    },
    nickfilter: {
        enabled: { type: Boolean, default: false },
        words: { type: [String], default: [] },
        action: { type: String, default: 'rename' }, // rename | kick
    },
    invites: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        counts: { type: [{ userId: String, count: Number }], default: [] },
    },
}, { minimize: false });

const SetupConfig = mongoose.models.SetupConfig || mongoose.model('SetupConfig', setupSchema);

// Existing subsystem models we mirror into (guard against re-compilation).
const ticketConfigSchema = new mongoose.Schema({
    guildId: { type: String, unique: true }, staffRoleId: String, staffRoleId2: String, categoryId: String,
});
const TicketConfig = mongoose.models.TicketConfig || mongoose.model('TicketConfig', ticketConfigSchema);

const presenceSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true },
    status: String, type: String, text: String,
});
const PresenceConfig = mongoose.models.PresenceConfig || mongoose.model('PresenceConfig', presenceSchema);

async function getConfig(guildId) {
    let cfg = await SetupConfig.findOne({ guildId });
    if (!cfg) cfg = await SetupConfig.create({ guildId });
    return cfg;
}

// ----------------------------------------------------------------------------
// 2. SHARED UI HELPERS
// ----------------------------------------------------------------------------

const BRAND = 'Kansas State Roleplay';
const ACCENT = 0x3b82f6;

const onoff = b => (b ? '🟢 Enabled' : '⚪ Disabled');
const chanMention = id => (id ? `<#${id}>` : '*not set*');
const roleMention = id => (id ? `<@&${id}>` : '*not set*');
const roleList = ids => (ids && ids.length ? ids.map(r => `<@&${r}>`).join(', ') : '*none*');
const ephemeral = { flags: [MessageFlags.Ephemeral] };

function backRow(section = 'home') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:home:open').setLabel('Main Menu').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
    );
}

function toggleButton(section, enabled) {
    return new ButtonBuilder()
        .setCustomId(`setup:${section}:toggle`)
        .setLabel(enabled ? 'Disable' : 'Enable')
        .setEmoji(enabled ? '🟥' : '🟩')
        .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);
}

// Each section: { key, label, emoji, desc, group }
const SECTIONS = [
    // — Engagement & content —
    { key: 'welcome', label: 'Welcome Messages', emoji: '👋', desc: 'Greet new members', group: 'engagement' },
    { key: 'goodbye', label: 'Goodbye Messages', emoji: '🚪', desc: 'Announce departures', group: 'engagement' },
    { key: 'autorole', label: 'Auto Roles', emoji: '🎭', desc: 'Roles given on join', group: 'engagement' },
    { key: 'reactionRoles', label: 'Reaction Roles', emoji: '🔘', desc: 'Self-assign via reactions', group: 'engagement' },
    { key: 'selfroles', label: 'Self-Role Buttons', emoji: '🟦', desc: 'Self-assign via buttons', group: 'engagement' },
    { key: 'autoresponders', label: 'Auto Responders', emoji: '💬', desc: 'Trigger → reply', group: 'engagement' },
    { key: 'autoreact', label: 'Auto React', emoji: '😀', desc: 'Auto-add reactions', group: 'engagement' },
    { key: 'sticky', label: 'Sticky Messages', emoji: '📌', desc: 'Pin text to channel bottom', group: 'engagement' },
    { key: 'birthdays', label: 'Birthdays', emoji: '🎂', desc: 'Birthday announcements', group: 'engagement' },
    { key: 'embedbuilder', label: 'Embed Builder', emoji: '🖼️', desc: 'Compose & send embeds', group: 'engagement' },
    // — Moderation & safety —
    { key: 'filter', label: 'Word Filter', emoji: '🧹', desc: 'Block banned words', group: 'moderation' },
    { key: 'linkfilter', label: 'Link Filter', emoji: '🔗', desc: 'Block links & invites', group: 'moderation' },
    { key: 'antispam', label: 'Anti-Spam', emoji: '🛡️', desc: 'Rate-limit spammers', group: 'moderation' },
    { key: 'antiraid', label: 'Anti-Raid', emoji: '🚨', desc: 'Mass-join protection', group: 'moderation' },
    { key: 'joingate', label: 'Join Gate', emoji: '⛔', desc: 'Minimum account age', group: 'moderation' },
    { key: 'verification', label: 'Verification', emoji: '✅', desc: 'Gate new members', group: 'moderation' },
    { key: 'logging', label: 'Server Logging', emoji: '📋', desc: 'Audit events', group: 'moderation' },
    { key: 'serverlock', label: 'Server Lockdown', emoji: '🔒', desc: 'Lock/unlock all channels', group: 'moderation' },
    { key: 'modtools', label: 'Mod Tools', emoji: '🔨', desc: 'Mute role, dehoist, mentions', group: 'moderation' },
    // — Systems —
    { key: 'tickets', label: 'Ticket System', emoji: '🎫', desc: 'Support tickets', group: 'systems' },
    { key: 'staffApps', label: 'Staff Applications', emoji: '📝', desc: 'Staff recruitment', group: 'systems' },
    { key: 'suggestions', label: 'Suggestions', emoji: '💡', desc: 'Suggestion board', group: 'systems' },
    { key: 'starboard', label: 'Starboard', emoji: '⭐', desc: 'Highlight top messages', group: 'systems' },
    { key: 'leveling', label: 'Leveling / XP', emoji: '📈', desc: 'XP, levels & role rewards', group: 'systems' },
    { key: 'economy', label: 'Economy', emoji: '💰', desc: 'Currency & rewards', group: 'systems' },
    { key: 'autopublish', label: 'Auto Publish', emoji: '📣', desc: 'Crosspost announcements', group: 'systems' },
    { key: 'stats', label: 'Server Stats', emoji: '📊', desc: 'Live member counters', group: 'systems' },
    { key: 'presence', label: 'Bot Presence', emoji: '🤖', desc: "The bot's status", group: 'systems' },
    // — Added systems —
    { key: 'counting', label: 'Counting Game', emoji: '🔢', desc: 'Channel counting game', group: 'engagement' },
    { key: 'boost', label: 'Boost Messages', emoji: '💜', desc: 'Thank server boosters', group: 'engagement' },
    { key: 'dropdownroles', label: 'Dropdown Roles', emoji: '⬇️', desc: 'Self-assign via a menu', group: 'engagement' },
    { key: 'stickyroles', label: 'Sticky Roles', emoji: '🧷', desc: 'Restore roles on rejoin', group: 'moderation' },
    { key: 'scheduled', label: 'Scheduled Messages', emoji: '⏰', desc: 'Recurring announcements', group: 'systems' },
    { key: 'tempvoice', label: 'Temp Voice', emoji: '🔊', desc: 'Join-to-create channels', group: 'systems' },
    { key: 'ticketpanel', label: 'Ticket Panel', emoji: '📮', desc: 'Post a ticket opener', group: 'systems' },
    { key: 'backup', label: 'Backup / Restore', emoji: '💾', desc: 'Export & import config', group: 'systems' },
    // — Final batch —
    { key: 'autothread', label: 'Auto Threads', emoji: '🧵', desc: 'Thread every message', group: 'engagement' },
    { key: 'pollmaker', label: 'Poll Maker', emoji: '📊', desc: 'Post a reaction poll', group: 'engagement' },
    { key: 'mediaonly', label: 'Media-Only', emoji: '🖼️', desc: 'Images-only channels', group: 'moderation' },
    { key: 'warnings', label: 'Warnings', emoji: '⚠️', desc: 'Infractions & auto-actions', group: 'moderation' },
    { key: 'announceping', label: 'Announce Ping', emoji: '🔔', desc: 'Ping a role on post', group: 'systems' },
    { key: 'branding', label: 'Branding', emoji: '🎨', desc: 'Name, colour & support', group: 'systems' },
    // — Extras —
    { key: 'shop', label: 'Economy Shop', emoji: '🛒', desc: 'Buy roles with currency', group: 'systems' },
    { key: 'autopurge', label: 'Auto Purge', emoji: '🧽', desc: 'Periodic channel cleanup', group: 'moderation' },
    { key: 'nickfilter', label: 'Nickname Filter', emoji: '🪪', desc: 'Block bad nicknames', group: 'moderation' },
    { key: 'invites', label: 'Invite Tracker', emoji: '📨', desc: 'Track who invited whom', group: 'systems' },
    { key: 'massrole', label: 'Mass Role', emoji: '👥', desc: 'Add/remove a role for all', group: 'systems' },
    { key: 'diagnostics', label: 'Diagnostics', emoji: '🩺', desc: 'Check permissions & config', group: 'systems' },
    { key: 'help', label: 'Help / About', emoji: 'ℹ️', desc: 'Guide & support links', group: 'systems' },
];

const GROUPS = [
    { id: 'engagement', label: 'Engagement & Content', emoji: '✨' },
    { id: 'moderation', label: 'Moderation & Safety', emoji: '🛡️' },
    { id: 'systems', label: 'Systems', emoji: '⚙️' },
];

// ----------------------------------------------------------------------------
// 3. MAIN MENU
// ----------------------------------------------------------------------------

// Whether a section counts as "on" for the status dots.
function isActive(cfg, key) {
    const v = cfg[key];
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v.enabled === 'boolean') return v.enabled;
    if (Array.isArray(v.menus)) return v.menus.length > 0;
    if (Array.isArray(v.messages)) return v.messages.length > 0;
    if (Array.isArray(v.rules)) return v.rules.length > 0;
    if (key === 'modtools') return Boolean(v.muteRoleId || v.dehoist || v.maxMentions);
    return false;
}
const TOOL_KEYS = new Set(['embedbuilder', 'backup', 'ticketpanel', 'pollmaker', 'branding', 'help', 'diagnostics', 'massrole']);
function statusDot(cfg, key) {
    if (key === 'presence') return '🤖';
    if (TOOL_KEYS.has(key)) return '🛠️';
    return isActive(cfg, key) ? '🟢' : '⚪';
}

function homePanel(cfg) {
    const embed = new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle(`⚙️ ${BRAND} — Server Setup`)
        .setDescription('Pick a category from a menu below. 🟢 = on, ⚪ = off. Everything saves instantly and takes effect live.')
        .setFooter({ text: `Setup panel · ${SECTIONS.length} systems · only visible to you` });

    for (const grp of GROUPS) {
        const items = SECTIONS.filter(s => s.group === grp.id);
        embed.addFields({
            name: `${grp.emoji} ${grp.label}`,
            value: items.map(s => `${statusDot(cfg, s.key)} ${s.emoji} ${s.label}`).join('\n'),
            inline: true,
        });
    }

    // One select per group (each well under Discord's 25-option ceiling).
    const rows = GROUPS.map(grp => new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`setup:home:nav:${grp.id}`) // unique per select; action stays "nav"
            .setPlaceholder(`${grp.emoji} ${grp.label}…`)
            .addOptions(SECTIONS.filter(s => s.group === grp.id).map(s => ({ label: s.label, value: s.key, emoji: s.emoji, description: s.desc }))),
    ));
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:home:overview').setLabel('Full Overview').setEmoji('🔎').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('setup:home:reset').setLabel('Reset All').setEmoji('♻️').setStyle(ButtonStyle.Danger),
    ));

    return { embeds: [embed], components: rows };
}

// ----------------------------------------------------------------------------
// 4. SECTION PANELS — each returns { embeds, components }
// ----------------------------------------------------------------------------

const PANELS = {};

// ---- Welcome --------------------------------------------------------------
PANELS.welcome = cfg => {
    const w = cfg.welcome;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('👋 Welcome Messages')
        .setDescription('Greet members when they join. Placeholders: `{user.mention}`, `{user.tag}`, `{user}`, `{server}`, `{memberCount}`.')
        .addFields(
            { name: 'Status', value: onoff(w.enabled), inline: true },
            { name: 'Channel', value: chanMention(w.channelId), inline: true },
            { name: 'Style', value: w.useEmbed ? `Embed (${w.color})` : 'Plain text', inline: true },
            { name: 'Message', value: '```' + (w.message || ' ').slice(0, 500) + '```' },
            { name: 'DM on join', value: w.dm ? `🟢 On — \`${(w.dmMessage || '').slice(0, 80)}\`` : '⚪ Off' },
            { name: 'Image URL', value: w.imageUrl ? w.imageUrl : '*none*' },
        );
    const rows = [
        new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:welcome:channel').setPlaceholder('📢 Welcome channel').addChannelTypes(ChannelType.GuildText)),
        new ActionRowBuilder().addComponents(
            toggleButton('welcome', w.enabled),
            new ButtonBuilder().setCustomId('setup:welcome:msg').setLabel('Edit Message').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('setup:welcome:embed').setLabel(w.useEmbed ? 'Use Plain Text' : 'Use Embed').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup:welcome:dm').setLabel(w.dm ? 'Disable DM' : 'Enable DM').setEmoji('✉️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup:welcome:image').setLabel('Set Image').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup:welcome:test').setLabel('Send Test').setEmoji('🧪').setStyle(ButtonStyle.Success),
        ),
        backRow(),
    ];
    return { embeds: [embed], components: rows };
};

// ---- Goodbye --------------------------------------------------------------
PANELS.goodbye = cfg => {
    const g = cfg.goodbye;
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('🚪 Goodbye Messages')
        .setDescription('Announce when members leave. Same placeholders as welcome.')
        .addFields(
            { name: 'Status', value: onoff(g.enabled), inline: true },
            { name: 'Channel', value: chanMention(g.channelId), inline: true },
            { name: 'Style', value: g.useEmbed ? `Embed (${g.color})` : 'Plain text', inline: true },
            { name: 'Message', value: '```' + (g.message || ' ').slice(0, 500) + '```' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:goodbye:channel').setPlaceholder('📢 Goodbye channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('goodbye', g.enabled),
                new ButtonBuilder().setCustomId('setup:goodbye:msg').setLabel('Edit Message').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:goodbye:embed').setLabel(g.useEmbed ? 'Use Plain Text' : 'Use Embed').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:goodbye:test').setLabel('Send Test').setEmoji('🧪').setStyle(ButtonStyle.Success),
            ),
            backRow(),
        ],
    };
};

// ---- Autorole -------------------------------------------------------------
PANELS.autorole = cfg => {
    const a = cfg.autorole;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🎭 Auto Roles')
        .setDescription('Roles automatically granted when a member (or bot) joins.')
        .addFields(
            { name: 'Status', value: onoff(a.enabled), inline: true },
            { name: 'Human roles', value: roleList(a.humanRoleIds) },
            { name: 'Bot roles', value: roleList(a.botRoleIds) },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:autorole:human').setPlaceholder('👤 Roles for humans').setMinValues(0).setMaxValues(10)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:autorole:bot').setPlaceholder('🤖 Roles for bots').setMinValues(0).setMaxValues(10)),
            new ActionRowBuilder().addComponents(toggleButton('autorole', a.enabled)),
            backRow(),
        ],
    };
};

// ---- Logging --------------------------------------------------------------
PANELS.logging = cfg => {
    const l = cfg.logging;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📋 Server Logging')
        .setDescription('Send audit events to channels. Pick a log type, then a channel.')
        .addFields(
            { name: 'Status', value: onoff(l.enabled), inline: true },
            { name: 'Member log (joins/leaves)', value: chanMention(l.memberLogId), inline: false },
            { name: 'Message log (edits/deletes)', value: chanMention(l.messageLogId), inline: false },
            { name: 'Mod log (bans/kicks/timeouts)', value: chanMention(l.modLogId), inline: false },
            { name: 'Voice log (join/leave/move)', value: chanMention(l.voiceLogId), inline: false },
            { name: 'Ignored channels', value: l.ignoredChannelIds.length ? l.ignoredChannelIds.map(chanMention).join(' ') : '*none*', inline: false },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:logging:pick').setPlaceholder('🎯 Which log to set…').addOptions(
                { label: 'Member log', value: 'memberLogId', emoji: '🚶' },
                { label: 'Message log', value: 'messageLogId', emoji: '💬' },
                { label: 'Mod log', value: 'modLogId', emoji: '🔨' },
                { label: 'Voice log', value: 'voiceLogId', emoji: '🔊' },
            )),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:logging:channel').setPlaceholder('📢 …then choose its channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:logging:ignore').setPlaceholder('🙈 Ignored channels (no message logs)').setMinValues(0).setMaxValues(15).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(toggleButton('logging', l.enabled)),
            backRow(),
        ],
    };
};

// ---- Server lockdown ------------------------------------------------------
PANELS.serverlock = cfg => {
    const s = cfg.serverlock;
    const embed = new EmbedBuilder().setColor(s.active ? 0xef4444 : ACCENT).setTitle('🔒 Server Lockdown')
        .setDescription('Instantly deny @everyone permission to send messages in every text channel, and restore it later. Useful during raids or emergencies.')
        .addFields(
            { name: 'State', value: s.active ? '🔴 **LOCKED**' : '🟢 Unlocked', inline: true },
            { name: 'Locked channels', value: `${s.lockedChannels.length}`, inline: true },
            { name: 'Reason', value: s.reason || '*none*', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:serverlock:lock').setLabel('Lock Server').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(s.active),
                new ButtonBuilder().setCustomId('setup:serverlock:unlock').setLabel('Unlock Server').setEmoji('🔓').setStyle(ButtonStyle.Success).setDisabled(!s.active),
                new ButtonBuilder().setCustomId('setup:serverlock:reason').setLabel('Set Reason').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Verification ---------------------------------------------------------
PANELS.verification = cfg => {
    const v = cfg.verification;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('✅ Verification')
        .setDescription('Require members to verify before they can chat. The verified role is granted on success.')
        .addFields(
            { name: 'Status', value: onoff(v.enabled), inline: true },
            { name: 'Mode', value: v.mode === 'captcha' ? '🔡 Captcha (DM)' : '🔘 Button', inline: true },
            { name: 'Verified role', value: roleMention(v.roleId), inline: true },
            { name: 'Verify channel', value: chanMention(v.channelId), inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:verification:role').setPlaceholder('🎭 Verified role').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:verification:channel').setPlaceholder('📢 Verify channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('verification', v.enabled),
                new ButtonBuilder().setCustomId('setup:verification:mode').setLabel(v.mode === 'captcha' ? 'Switch to Button' : 'Switch to Captcha').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:verification:post').setLabel('Post Panel').setEmoji('📨').setStyle(ButtonStyle.Success),
            ),
            backRow(),
        ],
    };
};

// ---- Tickets --------------------------------------------------------------
PANELS.tickets = cfg => {
    const t = cfg.tickets;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🎫 Ticket System')
        .setDescription('Support tickets. Settings here also feed the existing /ticket panel.')
        .addFields(
            { name: 'Status', value: onoff(t.enabled), inline: true },
            { name: 'Category', value: chanMention(t.categoryId), inline: true },
            { name: 'Primary staff role', value: roleMention(t.staffRoleId), inline: true },
            { name: 'Second staff role', value: roleMention(t.staffRoleId2), inline: true },
            { name: 'Transcript log', value: chanMention(t.logChannelId), inline: true },
            { name: 'Panel channel', value: chanMention(t.panelChannelId), inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:tickets:category').setPlaceholder('📁 Ticket category').addChannelTypes(ChannelType.GuildCategory)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:tickets:role1').setPlaceholder('🎭 Primary staff role').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:tickets:role2').setPlaceholder('🎭 Second staff role (optional)').setMinValues(0).setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:tickets:log').setPlaceholder('📜 Transcript log channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('tickets', t.enabled),
                new ButtonBuilder().setCustomId('setup:home:open').setLabel('Main Menu').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
            ),
        ],
    };
};

// ---- Staff Apps -----------------------------------------------------------
PANELS.staffApps = cfg => {
    const s = cfg.staffApps;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📝 Staff Applications')
        .setDescription('Configure where applications are posted and who reviews them.')
        .addFields(
            { name: 'Status', value: onoff(s.enabled), inline: true },
            { name: 'Apps category', value: chanMention(s.categoryId), inline: true },
            { name: 'Panel channel', value: chanMention(s.channelId), inline: true },
            { name: 'Reviewer role', value: roleMention(s.reviewRoleId), inline: true },
            { name: 'Accepted role', value: roleMention(s.acceptedRoleId), inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:staffApps:category').setPlaceholder('📁 Review category').addChannelTypes(ChannelType.GuildCategory)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:staffApps:review').setPlaceholder('🎭 Reviewer role').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:staffApps:accepted').setPlaceholder('🎭 Role given when accepted').setMinValues(0).setMaxValues(1)),
            new ActionRowBuilder().addComponents(toggleButton('staffApps', s.enabled)),
            backRow(),
        ],
    };
};

// ---- Filter ---------------------------------------------------------------
PANELS.filter = cfg => {
    const f = cfg.filter;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🧹 Word Filter')
        .setDescription('Block banned words. Action decides what happens when one is caught.')
        .addFields(
            { name: 'Status', value: onoff(f.enabled), inline: true },
            { name: 'Action', value: `\`${f.action}\`${f.action === 'timeout' ? ` (${f.timeoutMinutes}m)` : ''}`, inline: true },
            { name: 'Words', value: f.words.length ? `${f.words.length} configured` : '*none*', inline: true },
            { name: 'Bypass roles', value: roleList(f.whitelistRoleIds) },
            { name: 'Log channel', value: chanMention(f.logChannelId) },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:filter:action').setPlaceholder('⚙️ On detection…').addOptions(
                { label: 'Delete message', value: 'delete', emoji: '🗑️', default: f.action === 'delete' },
                { label: 'Delete + warn', value: 'warn', emoji: '⚠️', default: f.action === 'warn' },
                { label: 'Delete + timeout', value: 'timeout', emoji: '🔇', default: f.action === 'timeout' },
            )),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:filter:bypass').setPlaceholder('🎭 Roles that bypass the filter').setMinValues(0).setMaxValues(10)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:filter:log').setPlaceholder('📜 Filter log channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('filter', f.enabled),
                new ButtonBuilder().setCustomId('setup:filter:words').setLabel('Edit Words').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Reaction Roles -------------------------------------------------------
PANELS.reactionRoles = cfg => {
    const list = cfg.reactionRoles || [];
    const lines = list.length
        ? list.map((r, i) => `**${i + 1}.** [message](https://discord.com/channels/${cfg.guildId}/${r.channelId}/${r.messageId}) — ${r.pairs.map(p => `${p.emoji}→<@&${p.roleId}>`).join(' ')}`).join('\n')
        : '*No reaction-role messages yet.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔘 Reaction Roles')
        .setDescription('Let members self-assign roles by reacting. Add a mapping, then the bot reacts on the target message.')
        .addFields({ name: 'Configured', value: lines.slice(0, 1024) });
    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup:reactionRoles:add').setLabel('Add Mapping').setEmoji('➕').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('setup:reactionRoles:clear').setLabel('Clear All').setEmoji('🧹').setStyle(ButtonStyle.Danger).setDisabled(!list.length),
        ),
    ];
    if (list.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:reactionRoles:remove').setPlaceholder('🗑️ Remove a mapping…')
            .addOptions(list.map((r, i) => ({ label: `#${i + 1} · ${r.pairs.length} role(s)`, value: String(i), description: r.messageId })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Autoresponders -------------------------------------------------------
PANELS.autoresponders = cfg => {
    const list = cfg.autoresponders || [];
    const lines = list.length
        ? list.map((r, i) => `**${i + 1}.** \`${r.trigger}\` *(${r.match})* → ${r.response.slice(0, 60)}`).join('\n')
        : '*No auto responders yet.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('💬 Auto Responders')
        .setDescription('When a message matches a trigger, the bot replies automatically.')
        .addFields({ name: 'Configured', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:autoresponders:add').setLabel('Add Responder').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:autoresponders:clear').setLabel('Clear All').setEmoji('🧹').setStyle(ButtonStyle.Danger).setDisabled(!list.length),
    )];
    if (list.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:autoresponders:remove').setPlaceholder('🗑️ Remove a responder…')
            .addOptions(list.map((r, i) => ({ label: `${r.trigger}`.slice(0, 90), value: String(i) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Anti-Spam ------------------------------------------------------------
PANELS.antispam = cfg => {
    const a = cfg.antispam;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🛡️ Anti-Spam')
        .setDescription('Catch users sending messages too quickly.')
        .addFields(
            { name: 'Status', value: onoff(a.enabled), inline: true },
            { name: 'Threshold', value: `${a.maxMessages} msgs / ${a.intervalSeconds}s`, inline: true },
            { name: 'Action', value: a.action === 'timeout' ? `Timeout ${a.timeoutSeconds}s` : 'Delete', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:antispam:action').setPlaceholder('⚙️ On spam…').addOptions(
                { label: 'Delete messages', value: 'delete', emoji: '🗑️', default: a.action === 'delete' },
                { label: 'Timeout user', value: 'timeout', emoji: '🔇', default: a.action === 'timeout' },
            )),
            new ActionRowBuilder().addComponents(
                toggleButton('antispam', a.enabled),
                new ButtonBuilder().setCustomId('setup:antispam:limits').setLabel('Edit Limits').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Anti-Raid ------------------------------------------------------------
PANELS.antiraid = cfg => {
    const a = cfg.antiraid;
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('🚨 Anti-Raid')
        .setDescription('Detect a flood of joins in a short window and act on the wave.')
        .addFields(
            { name: 'Status', value: onoff(a.enabled), inline: true },
            { name: 'Trigger', value: `${a.joinThreshold} joins / ${a.windowSeconds}s`, inline: true },
            { name: 'Action', value: `\`${a.action}\``, inline: true },
            { name: 'Alert channel', value: chanMention(a.alertChannelId) },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:antiraid:action').setPlaceholder('⚙️ On raid…').addOptions(
                { label: 'Kick raiders', value: 'kick', emoji: '👢', default: a.action === 'kick' },
                { label: 'Ban raiders', value: 'ban', emoji: '🔨', default: a.action === 'ban' },
            )),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:antiraid:alert').setPlaceholder('📢 Alert channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('antiraid', a.enabled),
                new ButtonBuilder().setCustomId('setup:antiraid:limits').setLabel('Edit Trigger').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Starboard ------------------------------------------------------------
PANELS.starboard = cfg => {
    const s = cfg.starboard;
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('⭐ Starboard')
        .setDescription('Re-post messages that get enough star reactions into a showcase channel.')
        .addFields(
            { name: 'Status', value: onoff(s.enabled), inline: true },
            { name: 'Emoji', value: s.emoji, inline: true },
            { name: 'Threshold', value: `${s.threshold} reaction(s)`, inline: true },
            { name: 'Channel', value: chanMention(s.channelId) },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:starboard:channel').setPlaceholder('📢 Starboard channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('starboard', s.enabled),
                new ButtonBuilder().setCustomId('setup:starboard:settings').setLabel('Emoji & Threshold').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Server Stats ---------------------------------------------------------
PANELS.stats = cfg => {
    const s = cfg.stats;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📊 Server Stats')
        .setDescription('Live voice-channel counters. Use `{count}` in the templates. The bot renames the channels every few minutes.')
        .addFields(
            { name: 'Status', value: onoff(s.enabled), inline: true },
            { name: 'Member counter', value: chanMention(s.memberCountChannelId), inline: true },
            { name: 'Bot counter', value: chanMention(s.botCountChannelId), inline: true },
            { name: 'Member template', value: `\`${s.memberTemplate}\``, inline: true },
            { name: 'Bot template', value: `\`${s.botTemplate}\``, inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:stats:member').setPlaceholder('🔢 Member-count channel').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:stats:bot').setPlaceholder('🤖 Bot-count channel').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('stats', s.enabled),
                new ButtonBuilder().setCustomId('setup:stats:templates').setLabel('Edit Templates').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:stats:refresh').setLabel('Refresh Now').setEmoji('🔄').setStyle(ButtonStyle.Success),
            ),
            backRow(),
        ],
    };
};

// ---- Presence -------------------------------------------------------------
PANELS.presence = cfg => {
    const p = cfg.presence;
    const labels = { online: '🟢 Online', idle: '🌙 Idle', dnd: '⛔ DND', invisible: '⚫ Invisible' };
    const verbs = { playing: 'Playing', watching: 'Watching', listening: 'Listening to', competing: 'Competing in' };
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🤖 Bot Presence')
        .setDescription("Set the bot's status and activity. Applies instantly and survives restarts.")
        .addFields(
            { name: 'Status', value: labels[p.status] || p.status, inline: true },
            { name: 'Activity', value: `${verbs[p.type] || p.type} **${p.text}**`, inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:presence:status').setPlaceholder('🚦 Status').addOptions(
                { label: 'Online', value: 'online', emoji: '🟢', default: p.status === 'online' },
                { label: 'Idle', value: 'idle', emoji: '🌙', default: p.status === 'idle' },
                { label: 'Do Not Disturb', value: 'dnd', emoji: '⛔', default: p.status === 'dnd' },
                { label: 'Invisible', value: 'invisible', emoji: '⚫', default: p.status === 'invisible' },
            )),
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:presence:type').setPlaceholder('🎬 Activity type').addOptions(
                { label: 'Playing', value: 'playing', default: p.type === 'playing' },
                { label: 'Watching', value: 'watching', default: p.type === 'watching' },
                { label: 'Listening to', value: 'listening', default: p.type === 'listening' },
                { label: 'Competing in', value: 'competing', default: p.type === 'competing' },
            )),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:presence:text').setLabel('Edit Activity Text').setEmoji('✏️').setStyle(ButtonStyle.Primary)),
            backRow(),
        ],
    };
};

// ---- Leveling -------------------------------------------------------------
PANELS.leveling = cfg => {
    const l = cfg.leveling;
    const rewards = l.rewards.length ? l.rewards.sort((a, b) => a.level - b.level).map(r => `Lv ${r.level} → <@&${r.roleId}>`).join('\n') : '*none*';
    const top = [...l.users].sort((a, b) => b.xp - a.xp).slice(0, 5)
        .map((u, i) => `**${i + 1}.** <@${u.userId}> — Lv ${u.level} (${u.xp} XP)`).join('\n') || '*no data yet*';
    const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle('📈 Leveling / XP')
        .setDescription('Members earn XP for chatting and level up. Assign role rewards per level.')
        .addFields(
            { name: 'Status', value: onoff(l.enabled), inline: true },
            { name: 'XP / message', value: `${l.xpPerMessage} (×${l.multiplier})`, inline: true },
            { name: 'Voice XP / min', value: l.voiceXpPerMin ? `${l.voiceXpPerMin}` : 'Off', inline: true },
            { name: 'Cooldown', value: `${l.cooldownSeconds}s`, inline: true },
            { name: 'Announce', value: l.announceChannelId ? chanMention(l.announceChannelId) : 'In the chat channel', inline: true },
            { name: 'Reward stacking', value: l.stack ? 'Keep old roles' : 'Replace', inline: true },
            { name: 'Ignored channels', value: l.ignoredChannelIds.length ? l.ignoredChannelIds.map(chanMention).join(' ') : '*none*', inline: false },
            { name: 'Role rewards', value: rewards, inline: true },
            { name: 'Top members', value: top, inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:leveling:announce').setPlaceholder('📢 Level-up announce channel').setMinValues(0).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:leveling:ignore').setPlaceholder('🙈 Ignored (no-XP) channels').setMinValues(0).setMaxValues(10).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('leveling', l.enabled),
                new ButtonBuilder().setCustomId('setup:leveling:rates').setLabel('XP Rates').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:leveling:reward').setLabel('Add Reward').setEmoji('🏅').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setup:leveling:stack').setLabel(l.stack ? 'Replace Roles' : 'Stack Roles').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:leveling:announce_msg').setLabel('Announce Text').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:leveling:clear_rewards').setLabel('Clear Rewards').setEmoji('🧹').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('setup:leveling:reset').setLabel('Reset XP').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Economy --------------------------------------------------------------
PANELS.economy = cfg => {
    const e = cfg.economy;
    const top = [...e.accounts].sort((a, b) => b.balance - a.balance).slice(0, 5)
        .map((a, i) => `**${i + 1}.** <@${a.userId}> — ${e.symbol} ${a.balance}`).join('\n') || '*no accounts yet*';
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('💰 Economy')
        .setDescription('A simple server currency. Members earn from chatting, `daily`, and `work`.')
        .addFields(
            { name: 'Status', value: onoff(e.enabled), inline: true },
            { name: 'Currency', value: `${e.symbol} ${e.currencyName}`, inline: true },
            { name: 'Starting', value: `${e.startingBalance}`, inline: true },
            { name: 'Daily', value: `${e.dailyAmount}`, inline: true },
            { name: 'Work', value: `${e.workMin}–${e.workMax}`, inline: true },
            { name: 'Chat earn', value: `${e.chatEarn}/msg`, inline: true },
            { name: 'Richest', value: top, inline: false },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(
                toggleButton('economy', e.enabled),
                new ButtonBuilder().setCustomId('setup:economy:currency').setLabel('Currency').setEmoji('🪙').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:economy:amounts').setLabel('Amounts').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:economy:grant').setLabel('Give / Take').setEmoji('💸').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setup:economy:panel').setLabel('Post Member Panel').setEmoji('📨').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:economy:reset').setLabel('Reset Economy').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Embed Builder --------------------------------------------------------
PANELS.embedbuilder = cfg => {
    const d = cfg.embedbuilder.draft;
    const preview = new EmbedBuilder().setColor(parseColor(d.color));
    if (d.title) preview.setTitle(d.title);
    if (d.description) preview.setDescription(d.description);
    if (d.image) preview.setImage(d.image);
    if (d.thumbnail) preview.setThumbnail(d.thumbnail);
    if (d.footer) preview.setFooter({ text: d.footer });
    if (d.authorName) preview.setAuthor({ name: d.authorName });
    if (!d.title && !d.description) preview.setDescription('*Empty draft — use the buttons below to build your embed.*');

    const info = new EmbedBuilder().setColor(ACCENT).setTitle('🖼️ Embed Builder')
        .setDescription(`Compose a rich embed, choose a channel, and send it. Saved templates: **${cfg.embedbuilder.saved.length}**.`)
        .addFields({ name: 'Target channel', value: chanMention(d.channelId), inline: true }, { name: 'Colour', value: d.color, inline: true });

    return {
        embeds: [info, preview], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:embedbuilder:channel').setPlaceholder('📢 Send to channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:embedbuilder:content').setLabel('Title & Body').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:embedbuilder:media').setLabel('Images & Footer').setEmoji('🖼️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:embedbuilder:color').setLabel('Colour').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:embedbuilder:send').setLabel('Send').setEmoji('📨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setup:embedbuilder:save').setLabel('Save Template').setEmoji('💾').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:embedbuilder:clear').setLabel('Clear Draft').setEmoji('🧹').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Suggestions ----------------------------------------------------------
PANELS.suggestions = cfg => {
    const s = cfg.suggestions;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('💡 Suggestions')
        .setDescription('Messages posted in the suggestion channel are reformatted into an embed with voting reactions.')
        .addFields(
            { name: 'Status', value: onoff(s.enabled), inline: true },
            { name: 'Channel', value: chanMention(s.channelId), inline: true },
            { name: 'Votes', value: `${s.upvote} / ${s.downvote}`, inline: true },
            { name: 'Anonymous', value: s.anonymous ? '🟢 Yes' : '⚪ No', inline: true },
            { name: 'Auto-thread', value: s.autoThread ? '🟢 Yes' : '⚪ No', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:suggestions:channel').setPlaceholder('📢 Suggestion channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('suggestions', s.enabled),
                new ButtonBuilder().setCustomId('setup:suggestions:emojis').setLabel('Vote Emojis').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:suggestions:anon').setLabel(s.anonymous ? 'Show Authors' : 'Anonymous').setEmoji('🕵️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:suggestions:thread').setLabel(s.autoThread ? 'No Threads' : 'Auto Thread').setEmoji('🧵').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Self-role button menus ----------------------------------------------
PANELS.selfroles = cfg => {
    const menus = cfg.selfroles.menus || [];
    const lines = menus.length
        ? menus.map((m, i) => `**${i + 1}.** ${m.title} — ${m.roles.length} role(s) [${m.messageId ? 'posted' : 'draft'}]`).join('\n')
        : '*No self-role menus yet. Create one, add roles, then post it.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🟦 Self-Role Buttons')
        .setDescription('Create a message with buttons members click to toggle their own roles.')
        .addFields({ name: 'Menus', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:selfroles:new').setLabel('New Menu').setEmoji('➕').setStyle(ButtonStyle.Success))];
    if (menus.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:selfroles:pick').setPlaceholder('🛠️ Manage a menu…')
            .addOptions(menus.map((m, i) => ({ label: `#${i + 1} · ${m.title}`.slice(0, 90), value: String(i), description: `${m.roles.length} role(s)` })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// One menu's management view.
PANELS._selfroleMenu = (cfg, idx) => {
    const m = cfg.selfroles.menus[idx];
    if (!m) return PANELS.selfroles(cfg);
    const roleLines = m.roles.length ? m.roles.map(r => `${r.emoji || '•'} <@&${r.roleId}> — \`${r.label}\``).join('\n') : '*no roles yet*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`🟦 Menu: ${m.title}`)
        .setDescription('Add roles (up to 5), then post the menu to a channel.')
        .addFields({ name: 'Roles', value: roleLines }, { name: 'Posted', value: m.messageId ? `In <#${m.channelId}>` : 'Not yet' });
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`setup:selfroles:addrole:${idx}`).setPlaceholder('➕ Add a role to this menu').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`setup:selfroles:post:${idx}`).setPlaceholder('📨 Post menu to channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`setup:selfroles:title:${idx}`).setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`setup:selfroles:clearroles:${idx}`).setLabel('Clear Roles').setEmoji('🧹').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`setup:selfroles:delete:${idx}`).setLabel('Delete Menu').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            ),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:selfroles:back').setLabel('Back to Menus').setEmoji('↩️').setStyle(ButtonStyle.Secondary)),
        ],
    };
};

// ---- Sticky messages ------------------------------------------------------
PANELS.sticky = cfg => {
    const list = cfg.sticky.messages || [];
    const lines = list.length
        ? list.map((m, i) => `**${i + 1}.** <#${m.channelId}> — every ${m.every} msgs\n> ${m.content.slice(0, 60)}`).join('\n')
        : '*No sticky messages. Add one to keep text pinned to a channel\'s bottom.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📌 Sticky Messages')
        .setDescription('Keeps a message stuck at the bottom of a channel by re-posting it after activity.')
        .addFields({ name: 'Active', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:sticky:add').setLabel('Add Sticky').setEmoji('➕').setStyle(ButtonStyle.Success))];
    if (list.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:sticky:remove').setPlaceholder('🗑️ Remove a sticky…')
            .addOptions(list.map((m, i) => ({ label: `#${i + 1}`, value: String(i), description: m.content.slice(0, 90) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Link filter ----------------------------------------------------------
PANELS.linkfilter = cfg => {
    const f = cfg.linkfilter;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔗 Link Filter')
        .setDescription('Block links and/or Discord invites. Whitelisted roles and channels are exempt.')
        .addFields(
            { name: 'Status', value: onoff(f.enabled), inline: true },
            { name: 'Block links', value: f.blockLinks ? '🟢 Yes' : '⚪ No', inline: true },
            { name: 'Block invites', value: f.blockInvites ? '🟢 Yes' : '⚪ No', inline: true },
            { name: 'Action', value: `\`${f.action}\``, inline: true },
            { name: 'Bypass roles', value: roleList(f.whitelistRoleIds) },
            { name: 'Bypass channels', value: f.whitelistChannelIds.length ? f.whitelistChannelIds.map(chanMention).join(' ') : '*none*' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:linkfilter:roles').setPlaceholder('🎭 Bypass roles').setMinValues(0).setMaxValues(10)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:linkfilter:channels').setPlaceholder('📂 Bypass channels').setMinValues(0).setMaxValues(10).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('linkfilter', f.enabled),
                new ButtonBuilder().setCustomId('setup:linkfilter:links').setLabel(f.blockLinks ? 'Allow Links' : 'Block Links').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:linkfilter:invites').setLabel(f.blockInvites ? 'Allow Invites' : 'Block Invites').setEmoji('📨').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:linkfilter:action').setLabel(f.action === 'warn' ? 'Just Delete' : 'Delete + Warn').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Auto publish ---------------------------------------------------------
PANELS.autopublish = cfg => {
    const a = cfg.autopublish;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📣 Auto Publish')
        .setDescription('Automatically publish (crosspost) every message posted in selected **announcement** channels.')
        .addFields(
            { name: 'Status', value: onoff(a.enabled), inline: true },
            { name: 'Channels', value: a.channelIds.length ? a.channelIds.map(chanMention).join(' ') : '*none*' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:autopublish:channels').setPlaceholder('📢 Announcement channels').setMinValues(0).setMaxValues(10).addChannelTypes(ChannelType.GuildAnnouncement)),
            new ActionRowBuilder().addComponents(toggleButton('autopublish', a.enabled)),
            backRow(),
        ],
    };
};

// ---- Join gate ------------------------------------------------------------
PANELS.joingate = cfg => {
    const j = cfg.joingate;
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('⛔ Join Gate')
        .setDescription('Automatically remove accounts younger than a minimum age — a simple bot/alt deterrent.')
        .addFields(
            { name: 'Status', value: onoff(j.enabled), inline: true },
            { name: 'Min account age', value: `${j.minAccountAgeDays} day(s)`, inline: true },
            { name: 'Action', value: `\`${j.action}\``, inline: true },
            { name: 'Alert channel', value: chanMention(j.alertChannelId) },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:joingate:alert').setPlaceholder('📢 Alert channel').setMinValues(0).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('joingate', j.enabled),
                new ButtonBuilder().setCustomId('setup:joingate:age').setLabel('Set Min Age').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:joingate:action').setLabel(j.action === 'ban' ? 'Switch to Kick' : 'Switch to Ban').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Birthdays ------------------------------------------------------------
PANELS.birthdays = cfg => {
    const b = cfg.birthdays;
    const embed = new EmbedBuilder().setColor(0xec4899).setTitle('🎂 Birthdays')
        .setDescription('Members register their birthday and the bot celebrates them each day.')
        .addFields(
            { name: 'Status', value: onoff(b.enabled), inline: true },
            { name: 'Channel', value: chanMention(b.channelId), inline: true },
            { name: 'Birthday role', value: roleMention(b.roleId), inline: true },
            { name: 'Registered', value: `${b.entries.length} member(s)`, inline: true },
            { name: 'Message', value: '```' + (b.message || ' ').slice(0, 200) + '```' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:birthdays:channel').setPlaceholder('📢 Announcement channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:birthdays:role').setPlaceholder('🎭 Birthday role (optional)').setMinValues(0).setMaxValues(1)),
            new ActionRowBuilder().addComponents(
                toggleButton('birthdays', b.enabled),
                new ButtonBuilder().setCustomId('setup:birthdays:msg').setLabel('Message').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:birthdays:panel').setLabel('Post Register Panel').setEmoji('📨').setStyle(ButtonStyle.Success),
            ),
            backRow(),
        ],
    };
};

// ---- Auto react -----------------------------------------------------------
PANELS.autoreact = cfg => {
    const a = cfg.autoreact;
    const lines = a.rules.length ? a.rules.map((r, i) => `**${i + 1}.** <#${r.channelId}> → ${r.emojis.join(' ')}`).join('\n') : '*No rules. Add one to auto-react to messages in a channel.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('😀 Auto React')
        .setDescription('The bot automatically reacts to every message in chosen channels (great for media or suggestion channels).')
        .addFields({ name: 'Status', value: onoff(a.enabled), inline: true }, { name: 'Rules', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        toggleButton('autoreact', a.enabled),
        new ButtonBuilder().setCustomId('setup:autoreact:add').setLabel('Add Rule').setEmoji('➕').setStyle(ButtonStyle.Success),
    )];
    if (a.rules.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:autoreact:remove').setPlaceholder('🗑️ Remove a rule…')
            .addOptions(a.rules.map((r, i) => ({ label: `#${i + 1}`, value: String(i), description: r.emojis.join(' ').slice(0, 90) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Mod tools ------------------------------------------------------------
PANELS.modtools = cfg => {
    const m = cfg.modtools;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔨 Mod Tools')
        .setDescription('Quality-of-life moderation helpers.')
        .addFields(
            { name: 'Mute role', value: roleMention(m.muteRoleId), inline: true },
            { name: 'Dehoist names', value: m.dehoist ? '🟢 On' : '⚪ Off', inline: true },
            { name: 'Max mentions', value: m.maxMentions ? `${m.maxMentions} (${m.maxMentionsAction})` : 'Off', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:modtools:muterole').setPlaceholder('🔇 Mute role').setMinValues(0).setMaxValues(1)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:modtools:dehoist').setLabel(m.dehoist ? 'Disable Dehoist' : 'Enable Dehoist').setEmoji('🔠').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:modtools:mentions').setLabel('Mention Limit').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:modtools:mentionaction').setLabel(m.maxMentionsAction === 'timeout' ? 'Just Delete' : 'Delete + Timeout').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Counting game --------------------------------------------------------
PANELS.counting = cfg => {
    const c = cfg.counting;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔢 Counting Game')
        .setDescription('Members count up one number at a time in the chosen channel. No double-counting; wrong numbers can reset the streak.')
        .addFields(
            { name: 'Status', value: onoff(c.enabled), inline: true },
            { name: 'Channel', value: chanMention(c.channelId), inline: true },
            { name: 'Current', value: `${c.current}`, inline: true },
            { name: 'High score', value: `${c.highScore}`, inline: true },
            { name: 'On wrong number', value: c.resetOnFail ? 'Reset to 0' : 'Just delete', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:counting:channel').setPlaceholder('🔢 Counting channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('counting', c.enabled),
                new ButtonBuilder().setCustomId('setup:counting:reset').setLabel('Reset Count').setEmoji('♻️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('setup:counting:fail').setLabel(c.resetOnFail ? 'Don\'t Reset' : 'Reset on Fail').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Boost messages -------------------------------------------------------
PANELS.boost = cfg => {
    const b = cfg.boost;
    const embed = new EmbedBuilder().setColor(0xf47fff).setTitle('💜 Boost Messages')
        .setDescription('Celebrate members who boost the server. Placeholders: `{user.mention}`, `{server}`.')
        .addFields(
            { name: 'Status', value: onoff(b.enabled), inline: true },
            { name: 'Channel', value: chanMention(b.channelId), inline: true },
            { name: 'Message', value: '```' + (b.message || ' ').slice(0, 300) + '```' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:boost:channel').setPlaceholder('📢 Boost announcement channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('boost', b.enabled),
                new ButtonBuilder().setCustomId('setup:boost:msg').setLabel('Edit Message').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Dropdown role menus --------------------------------------------------
PANELS.dropdownroles = cfg => {
    const menus = cfg.dropdownroles.menus || [];
    const lines = menus.length
        ? menus.map((m, i) => `**${i + 1}.** ${m.title} — ${m.roles.length} role(s) [${m.messageId ? 'posted' : 'draft'}]`).join('\n')
        : '*No dropdown menus yet.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('⬇️ Dropdown Roles')
        .setDescription('Self-assign roles from a single select-menu (good for many roles at once).')
        .addFields({ name: 'Menus', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:dropdownroles:new').setLabel('New Menu').setEmoji('➕').setStyle(ButtonStyle.Success))];
    if (menus.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:dropdownroles:pick').setPlaceholder('🛠️ Manage a menu…')
            .addOptions(menus.map((m, i) => ({ label: `#${i + 1} · ${m.title}`.slice(0, 90), value: String(i), description: `${m.roles.length} role(s)` })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

PANELS._dropdownMenu = (cfg, idx) => {
    const m = cfg.dropdownroles.menus[idx];
    if (!m) return PANELS.dropdownroles(cfg);
    const roleLines = m.roles.length ? m.roles.map(r => `${r.emoji || '•'} <@&${r.roleId}> — \`${r.label}\``).join('\n') : '*no roles yet*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`⬇️ Menu: ${m.title}`)
        .setDescription(`Add up to 25 roles, set how many a member may pick, then post it.`)
        .addFields(
            { name: 'Roles', value: roleLines.slice(0, 1024) },
            { name: 'Pick range', value: `${m.min}–${m.max}`, inline: true },
            { name: 'Posted', value: m.messageId ? `In <#${m.channelId}>` : 'Not yet', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`setup:dropdownroles:addrole:${idx}`).setPlaceholder('➕ Add a role').setMaxValues(1)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`setup:dropdownroles:post:${idx}`).setPlaceholder('📨 Post menu to channel').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`setup:dropdownroles:range:${idx}`).setLabel('Pick Range').setEmoji('🔢').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`setup:dropdownroles:clearroles:${idx}`).setLabel('Clear Roles').setEmoji('🧹').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`setup:dropdownroles:delete:${idx}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            ),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:dropdownroles:back').setLabel('Back to Menus').setEmoji('↩️').setStyle(ButtonStyle.Secondary)),
        ],
    };
};

// ---- Sticky roles ---------------------------------------------------------
PANELS.stickyroles = cfg => {
    const s = cfg.stickyroles;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🧷 Sticky Roles')
        .setDescription("Remembers each member's roles when they leave and restores them automatically if they rejoin.")
        .addFields(
            { name: 'Status', value: onoff(s.enabled), inline: true },
            { name: 'Stored members', value: `${s.store.length}`, inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(
                toggleButton('stickyroles', s.enabled),
                new ButtonBuilder().setCustomId('setup:stickyroles:clear').setLabel('Clear Storage').setEmoji('🧹').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Scheduled messages ---------------------------------------------------
PANELS.scheduled = cfg => {
    const list = cfg.scheduled.messages || [];
    const lines = list.length
        ? list.map((m, i) => `**${i + 1}.** <#${m.channelId}> every ${m.intervalMinutes}m\n> ${m.content.slice(0, 60)}`).join('\n')
        : '*No scheduled messages.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('⏰ Scheduled Messages')
        .setDescription('Post a recurring message to a channel on a fixed interval (e.g. rules reminders).')
        .addFields({ name: 'Active', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:scheduled:add').setLabel('Add Schedule').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:scheduled:sendall').setLabel('Send All Now').setEmoji('📨').setStyle(ButtonStyle.Primary).setDisabled(!list.length),
    )];
    if (list.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:scheduled:remove').setPlaceholder('🗑️ Remove a schedule…')
            .addOptions(list.map((m, i) => ({ label: `#${i + 1} · every ${m.intervalMinutes}m`, value: String(i), description: m.content.slice(0, 90) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Temp voice -----------------------------------------------------------
PANELS.tempvoice = cfg => {
    const t = cfg.tempvoice;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔊 Temp Voice Channels')
        .setDescription('When a member joins the **hub** voice channel, the bot creates a personal voice channel for them and moves them in. It is deleted when empty. Template placeholder: `{user}`.')
        .addFields(
            { name: 'Status', value: onoff(t.enabled), inline: true },
            { name: 'Hub channel', value: chanMention(t.hubChannelId), inline: true },
            { name: 'Category', value: chanMention(t.categoryId), inline: true },
            { name: 'Name template', value: `\`${t.nameTemplate}\``, inline: true },
            { name: 'Live channels', value: `${t.active.length}`, inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:tempvoice:hub').setPlaceholder('🔊 Hub (join-to-create) channel').addChannelTypes(ChannelType.GuildVoice)),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:tempvoice:category').setPlaceholder('📁 Category for new channels').addChannelTypes(ChannelType.GuildCategory)),
            new ActionRowBuilder().addComponents(
                toggleButton('tempvoice', t.enabled),
                new ButtonBuilder().setCustomId('setup:tempvoice:template').setLabel('Name Template').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Ticket panel poster --------------------------------------------------
PANELS.ticketpanel = cfg => {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📮 Ticket Panel')
        .setDescription('Post a ready-to-use ticket opener (a category select menu) to a channel. It uses your Ticket System settings and the existing `ticket_select` handler.');
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:ticketpanel:post').setPlaceholder('📨 Post the ticket panel to…').addChannelTypes(ChannelType.GuildText)),
            backRow(),
        ],
    };
};

// ---- Backup / Restore -----------------------------------------------------
PANELS.backup = cfg => {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('💾 Backup / Restore')
        .setDescription('Export this server\'s entire setup configuration as a JSON file, or paste a previous export to restore it. User data (XP, balances, stored roles) is excluded from exports.');
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:backup:export').setLabel('Export JSON').setEmoji('📤').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:backup:import').setLabel('Import JSON').setEmoji('📥').setStyle(ButtonStyle.Success),
            ),
            backRow(),
        ],
    };
};

// ---- Auto threads ---------------------------------------------------------
PANELS.autothread = cfg => {
    const a = cfg.autothread;
    const lines = a.rules.length ? a.rules.map((r, i) => `**${i + 1}.** <#${r.channelId}> — \`${r.nameTemplate || '{user}'}\``).join('\n') : '*No rules. Add a channel to thread every message posted there.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🧵 Auto Threads')
        .setDescription('Creates a thread on every message in chosen channels (great for media, help or showcase channels). Template: `{user}`.')
        .addFields({ name: 'Status', value: onoff(a.enabled), inline: true }, { name: 'Rules', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        toggleButton('autothread', a.enabled),
        new ButtonBuilder().setCustomId('setup:autothread:add').setLabel('Add Channel').setEmoji('➕').setStyle(ButtonStyle.Success),
    )];
    if (a.rules.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:autothread:remove').setPlaceholder('🗑️ Remove a rule…')
            .addOptions(a.rules.map((r, i) => ({ label: `#${i + 1}`, value: String(i), description: r.nameTemplate || '{user}' })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Poll maker -----------------------------------------------------------
PANELS.pollmaker = cfg => {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📊 Poll Maker')
        .setDescription('Build a quick reaction poll (up to 10 options) and post it to any channel. Members vote with number reactions.');
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:pollmaker:channel').setPlaceholder('📢 Post the poll to…').addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:pollmaker:make').setLabel('Compose Poll').setEmoji('📝').setStyle(ButtonStyle.Primary)),
            backRow(),
        ],
    };
};

// ---- Media-only -----------------------------------------------------------
PANELS.mediaonly = cfg => {
    const m = cfg.mediaonly;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🖼️ Media-Only Channels')
        .setDescription('Messages without an image/video/attachment are removed in these channels.')
        .addFields(
            { name: 'Status', value: onoff(m.enabled), inline: true },
            { name: 'Allow links', value: m.allowLinks ? '🟢 Yes (links count as media)' : '⚪ No', inline: true },
            { name: 'Channels', value: m.channelIds.length ? m.channelIds.map(chanMention).join(' ') : '*none*' },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:mediaonly:channels').setPlaceholder('🖼️ Media-only channels').setMinValues(0).setMaxValues(10).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('mediaonly', m.enabled),
                new ButtonBuilder().setCustomId('setup:mediaonly:links').setLabel(m.allowLinks ? 'Disallow Links' : 'Allow Links').setEmoji('🔗').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Warnings -------------------------------------------------------------
PANELS.warnings = cfg => {
    const w = cfg.warnings;
    const actions = w.autoActions.length ? w.autoActions.sort((a, b) => a.count - b.count).map(a => `${a.count} → \`${a.action}\`${a.action === 'timeout' ? ` ${a.durationMinutes}m` : ''}`).join('\n') : '*none*';
    const counts = {};
    for (const r of w.records) counts[r.userId] = (counts[r.userId] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `<@${id}> — ${n}`).join('\n') || '*no warnings yet*';
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('⚠️ Warnings')
        .setDescription('Track member infractions and auto-punish at thresholds.')
        .addFields(
            { name: 'Status', value: onoff(w.enabled), inline: true },
            { name: 'Log channel', value: chanMention(w.logChannelId), inline: true },
            { name: 'Total records', value: `${w.records.length}`, inline: true },
            { name: 'Auto-actions', value: actions, inline: false },
            { name: 'Most warned', value: top, inline: false },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:warnings:log').setPlaceholder('📜 Warning log channel').setMinValues(0).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('warnings', w.enabled),
                new ButtonBuilder().setCustomId('setup:warnings:warn').setLabel('Warn a User').setEmoji('⚠️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:warnings:view').setLabel('View User').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setup:warnings:autoaction').setLabel('Add Auto-Action').setEmoji('⚙️').setStyle(ButtonStyle.Success),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:warnings:clearactions').setLabel('Clear Auto-Actions').setEmoji('🧹').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('setup:warnings:clearrecords').setLabel('Clear All Records').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Announce ping --------------------------------------------------------
PANELS.announceping = cfg => {
    const a = cfg.announceping;
    const lines = a.mappings.length ? a.mappings.map((m, i) => `**${i + 1}.** <#${m.channelId}> → <@&${m.roleId}>`).join('\n') : '*No mappings.*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🔔 Announce Ping')
        .setDescription('Automatically ping a role whenever a message is posted in a mapped channel.')
        .addFields({ name: 'Status', value: onoff(a.enabled), inline: true }, { name: 'Mappings', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        toggleButton('announceping', a.enabled),
        new ButtonBuilder().setCustomId('setup:announceping:add').setLabel('Add Mapping').setEmoji('➕').setStyle(ButtonStyle.Success),
    )];
    if (a.mappings.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:announceping:remove').setPlaceholder('🗑️ Remove a mapping…')
            .addOptions(a.mappings.map((m, i) => ({ label: `#${i + 1}`, value: String(i) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Branding -------------------------------------------------------------
PANELS.branding = cfg => {
    const b = cfg.branding;
    const embed = new EmbedBuilder().setColor(parseColor(b.accentColor)).setTitle('🎨 Branding')
        .setDescription('Cosmetic identity for the panel and posted embeds.')
        .addFields(
            { name: 'Display name', value: b.displayName || `*${BRAND}* (default)`, inline: true },
            { name: 'Accent colour', value: b.accentColor, inline: true },
            { name: 'Default mod-log', value: chanMention(b.modLogChannelId), inline: true },
            { name: 'Support invite', value: b.supportInvite || '*none*', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:branding:modlog').setPlaceholder('📜 Default mod-log channel').setMinValues(0).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:branding:edit').setLabel('Edit Branding').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Economy shop ---------------------------------------------------------
PANELS.shop = cfg => {
    const s = cfg.shop;
    const lines = s.items.length
        ? s.items.map((it, i) => `**${i + 1}.** ${it.name} — ${cfg.economy.symbol} ${it.price} → <@&${it.roleId}>`).join('\n')
        : '*No items. Add a role players can buy with currency.*';
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🛒 Economy Shop')
        .setDescription('Sell roles for your server currency. Post a shop panel members can buy from.')
        .addFields({ name: 'Status', value: onoff(s.enabled), inline: true }, { name: 'Currency', value: `${cfg.economy.symbol} ${cfg.economy.currencyName}`, inline: true }, { name: 'Items', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        toggleButton('shop', s.enabled),
        new ButtonBuilder().setCustomId('setup:shop:add').setLabel('Add Item').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:shop:post').setLabel('Post Shop').setEmoji('📨').setStyle(ButtonStyle.Primary),
    )];
    if (s.items.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:shop:remove').setPlaceholder('🗑️ Remove an item…')
            .addOptions(s.items.map((it, i) => ({ label: `${it.name}`.slice(0, 90), value: String(i), description: `${it.price}` })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Auto purge -----------------------------------------------------------
PANELS.autopurge = cfg => {
    const list = cfg.autopurge.tasks || [];
    const lines = list.length ? list.map((t, i) => `**${i + 1}.** <#${t.channelId}> every ${t.everyHours}h${t.keepPinned ? ' (keep pinned)' : ''}`).join('\n') : '*No purge tasks.*';
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('🧽 Auto Purge')
        .setDescription('Periodically bulk-deletes recent messages in a channel (e.g. a spam or commands channel). Messages older than 14 days can\'t be bulk-deleted by Discord.')
        .addFields({ name: 'Tasks', value: lines.slice(0, 1024) });
    const rows = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:autopurge:add').setLabel('Add Task').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:autopurge:now').setLabel('Purge All Now').setEmoji('🧽').setStyle(ButtonStyle.Danger).setDisabled(!list.length),
    )];
    if (list.length) {
        rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup:autopurge:remove').setPlaceholder('🗑️ Remove a task…')
            .addOptions(list.map((t, i) => ({ label: `#${i + 1} · every ${t.everyHours}h`, value: String(i) })))));
    }
    rows.push(backRow());
    return { embeds: [embed], components: rows };
};

// ---- Nickname filter ------------------------------------------------------
PANELS.nickfilter = cfg => {
    const n = cfg.nickfilter;
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🪪 Nickname Filter')
        .setDescription('Checks nicknames on join and change against a banned list.')
        .addFields(
            { name: 'Status', value: onoff(n.enabled), inline: true },
            { name: 'Action', value: n.action === 'kick' ? 'Kick' : 'Reset nickname', inline: true },
            { name: 'Words', value: n.words.length ? `${n.words.length} configured` : '*none*', inline: true },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(
                toggleButton('nickfilter', n.enabled),
                new ButtonBuilder().setCustomId('setup:nickfilter:words').setLabel('Edit Words').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setup:nickfilter:action').setLabel(n.action === 'kick' ? 'Switch to Rename' : 'Switch to Kick').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
            ),
            backRow(),
        ],
    };
};

// ---- Help / About ---------------------------------------------------------
PANELS.help = cfg => {
    const name = cfg.branding.displayName || BRAND;
    const embed = new EmbedBuilder().setColor(parseColor(cfg.branding.accentColor)).setTitle(`ℹ️ ${name} — Setup Help`)
        .setDescription(`This panel configures **${SECTIONS.length}** systems, grouped below. Pick any from the main menu; each saves instantly and runs live.`)
        .addFields(GROUPS.map(g => ({
            name: `${g.emoji} ${g.label}`,
            value: SECTIONS.filter(s => s.group === g.id).map(s => `${s.emoji} **${s.label}** — ${s.desc}`).join('\n').slice(0, 1024),
            inline: false,
        })))
        .setFooter({ text: 'Tip: use Backup → Export to save your config as a file.' });
    if (cfg.branding.supportInvite) embed.addFields({ name: 'Support', value: cfg.branding.supportInvite });
    return { embeds: [embed], components: [backRow()] };
};

// ---- Mass role ------------------------------------------------------------
PANELS.massrole = cfg => {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('👥 Mass Role')
        .setDescription('Select a role below, then apply it to (or remove it from) **every member**. On large servers this can take a little while; bots are skipped.');
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup:massrole:role').setPlaceholder('🎭 Pick the role to apply').setMaxValues(1)),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup:massrole:addall').setLabel('Add to Everyone').setEmoji('➕').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setup:massrole:removeall').setLabel('Remove from Everyone').setEmoji('➖').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('setup:massrole:humans').setLabel('Add to Humans Only').setEmoji('👤').setStyle(ButtonStyle.Primary),
            ),
            backRow(),
        ],
    };
};

// ---- Invite tracker -------------------------------------------------------
PANELS.invites = cfg => {
    const i = cfg.invites;
    const top = [...i.counts].sort((a, b) => b.count - a.count).slice(0, 5).map((c, n) => `**${n + 1}.** <@${c.userId}> — ${c.count} invite(s)`).join('\n') || '*no data yet*';
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📨 Invite Tracker')
        .setDescription('Detects which invite each new member used and credits the inviter. Requires the **Manage Server** permission.')
        .addFields(
            { name: 'Status', value: onoff(i.enabled), inline: true },
            { name: 'Announce channel', value: chanMention(i.channelId), inline: true },
            { name: 'Top inviters', value: top, inline: false },
        );
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('setup:invites:channel').setPlaceholder('📢 Join-announce channel').setMinValues(0).addChannelTypes(ChannelType.GuildText)),
            new ActionRowBuilder().addComponents(
                toggleButton('invites', i.enabled),
                new ButtonBuilder().setCustomId('setup:invites:reset').setLabel('Reset Counts').setEmoji('♻️').setStyle(ButtonStyle.Danger),
            ),
            backRow(),
        ],
    };
};

// ---- Diagnostics ----------------------------------------------------------
PANELS.diagnostics = cfg => {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🩺 Diagnostics')
        .setDescription('Run a health check on the bot\'s permissions and your enabled systems. Catches the most common "why isn\'t this working?" problems.');
    return {
        embeds: [embed], components: [
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setup:diagnostics:run').setLabel('Run Checks').setEmoji('🩺').setStyle(ButtonStyle.Primary)),
            backRow(),
        ],
    };
};

function renderSection(key, cfg) {
    const fn = PANELS[key];
    return fn ? fn(cfg) : homePanel(cfg);
}

// Build a diagnostics report for a guild + config.
function diagnosticsReport(guild, cfg) {
    const me = guild.members.me;
    const P = PermissionFlagsBits;
    const lines = [];
    const check = (ok, label) => lines.push(`${ok ? '✅' : '⚠️'} ${label}`);

    check(me.permissions.has(P.Administrator), 'Bot has Administrator (recommended)');
    check(me.permissions.has(P.ManageRoles), 'Manage Roles (autorole, self-roles, leveling, shop)');
    check(me.permissions.has(P.ManageChannels), 'Manage Channels (tickets, temp voice, stats)');
    check(me.permissions.has(P.ManageMessages), 'Manage Messages (filters, sticky, purge)');
    check(me.permissions.has(P.ModerateMembers), 'Timeout Members (anti-spam, warnings)');
    check(me.permissions.has(P.KickMembers) && me.permissions.has(P.BanMembers), 'Kick & Ban (anti-raid, join gate)');
    check(me.permissions.has(P.ManageNicknames), 'Manage Nicknames (dehoist, nickname filter)');

    const chanOk = id => !id || guild.channels.cache.has(id);
    const roleOk = id => !id || guild.roles.cache.has(id);
    if (cfg.welcome.enabled) check(chanOk(cfg.welcome.channelId) && cfg.welcome.channelId, 'Welcome: channel set & exists');
    if (cfg.verification.enabled) check(roleOk(cfg.verification.roleId) && cfg.verification.roleId, 'Verification: verified role set & exists');
    if (cfg.tickets.enabled) check(roleOk(cfg.tickets.staffRoleId) && cfg.tickets.staffRoleId, 'Tickets: staff role set & exists');
    if (cfg.starboard.enabled) check(chanOk(cfg.starboard.channelId) && cfg.starboard.channelId, 'Starboard: channel set & exists');
    if (cfg.suggestions.enabled) check(chanOk(cfg.suggestions.channelId) && cfg.suggestions.channelId, 'Suggestions: channel set & exists');
    if (cfg.counting.enabled) check(chanOk(cfg.counting.channelId) && cfg.counting.channelId, 'Counting: channel set & exists');
    if (cfg.tempvoice.enabled) check(chanOk(cfg.tempvoice.hubChannelId) && cfg.tempvoice.hubChannelId, 'Temp Voice: hub channel set & exists');
    if (cfg.birthdays.enabled) check(chanOk(cfg.birthdays.channelId) && cfg.birthdays.channelId, 'Birthdays: channel set & exists');
    if (cfg.economy.enabled && cfg.shop.enabled) check(cfg.shop.items.every(it => roleOk(it.roleId)), 'Shop: all item roles exist');
    if (cfg.modtools.muteRoleId) check(roleOk(cfg.modtools.muteRoleId), 'Mod Tools: mute role exists');
    if (cfg.leveling.enabled) check(cfg.leveling.rewards.every(r => roleOk(r.roleId)), 'Leveling: all reward roles exist');
    if (cfg.autorole.enabled) check([...cfg.autorole.humanRoleIds, ...cfg.autorole.botRoleIds].every(roleOk), 'Auto Roles: all roles exist');
    if (cfg.invites.enabled) check(me.permissions.has(P.ManageGuild), 'Invite Tracker: Manage Server permission present');
    if (cfg.logging.enabled) check([cfg.logging.memberLogId, cfg.logging.messageLogId, cfg.logging.modLogId, cfg.logging.voiceLogId].some(Boolean), 'Logging: at least one log channel set');
    if (cfg.verification.enabled) check(chanOk(cfg.verification.channelId) && cfg.verification.channelId, 'Verification: verify channel set & exists');

    const warnCount = lines.filter(l => l.startsWith('⚠️')).length;
    return new EmbedBuilder()
        .setColor(warnCount ? 0xf59e0b : 0x22c55e)
        .setTitle(`🩺 Diagnostics — ${warnCount ? `${warnCount} issue(s)` : 'all good'}`)
        .setDescription(lines.join('\n').slice(0, 4000))
        .setFooter({ text: warnCount ? 'Fix the ⚠️ items above.' : 'Everything checks out!' });
}

// ----------------------------------------------------------------------------
// 5. INTERACTION ROUTER
// ----------------------------------------------------------------------------

async function handleInteraction(interaction) {
    if (!interaction.inGuild()) return;
    // Gate: administrators only (the panel can grant roles / change everything).
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return safeReply(interaction, '❌ You need **Administrator** to use the setup panel.');
    }

    const [, section, action, arg] = interaction.customId.split(':');

    try {
        if (interaction.isModalSubmit()) return handleModal(interaction, section, action);

        const cfg = await getConfig(interaction.guildId);

        // Home navigation
        if (section === 'home') {
            if (action === 'nav') return update(interaction, renderSection(interaction.values[0], cfg));
            if (action === 'open') return update(interaction, homePanel(cfg));
            if (action === 'overview') return interaction.reply({ ...overviewEmbed(cfg), ...ephemeral });
            if (action === 'reset') return confirmReset(interaction);
            if (action === 'reset_yes') { await SetupConfig.deleteOne({ guildId: cfg.guildId }); const fresh = await getConfig(cfg.guildId); return update(interaction, homePanel(fresh)); }
            if (action === 'reset_no') return update(interaction, homePanel(cfg));
        }

        const handler = ACTIONS[section];
        if (handler) { await handler(interaction, cfg, action, arg); return; }

        return safeReply(interaction, '⚠️ Unknown setup action.');
    } catch (err) {
        console.error('[setup] handler error:', err);
        return safeReply(interaction, `❌ Something went wrong: ${err.message}`);
    }
}

// Convenience wrappers ------------------------------------------------------
function update(interaction, payload) {
    if (interaction.isModalSubmit() && !interaction.message) return interaction.reply({ ...payload, ...ephemeral });
    return interaction.update(payload);
}
function safeReply(interaction, content) {
    const p = { content, ...ephemeral };
    if (interaction.replied || interaction.deferred) return interaction.followUp(p).catch(() => null);
    return interaction.reply(p).catch(() => null);
}
async function saveAnd(interaction, cfg, section) {
    cfg.markModified(section);
    await cfg.save();
    return update(interaction, renderSection(section, cfg));
}

// ----------------------------------------------------------------------------
// 6. PER-SECTION ACTION HANDLERS
// ----------------------------------------------------------------------------

const ACTIONS = {
    async welcome(interaction, cfg, action) {
        const w = cfg.welcome;
        if (action === 'toggle') { w.enabled = !w.enabled; return saveAnd(interaction, cfg, 'welcome'); }
        if (action === 'channel') { w.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'welcome'); }
        if (action === 'embed') { w.useEmbed = !w.useEmbed; return saveAnd(interaction, cfg, 'welcome'); }
        if (action === 'dm') { w.dm = !w.dm; return saveAnd(interaction, cfg, 'welcome'); }
        if (action === 'msg') return showModal(interaction, 'setup:welcome:msg_modal', 'Welcome Message', [
            modalInput('message', 'Channel message', TextInputStyle.Paragraph, w.message, true),
            modalInput('dmMessage', 'DM message (if DM enabled)', TextInputStyle.Paragraph, w.dmMessage, false),
            modalInput('color', 'Embed colour hex (e.g. #3b82f6)', TextInputStyle.Short, w.color, false),
        ]);
        if (action === 'image') return showModal(interaction, 'setup:welcome:image_modal', 'Welcome Image', [
            modalInput('imageUrl', 'Image URL (blank to clear)', TextInputStyle.Short, w.imageUrl || '', false),
        ]);
        if (action === 'test') {
            await sendWelcome(interaction.member, cfg, true);
            return safeReply(interaction, '🧪 Sent a test welcome (using your account).');
        }
    },

    async goodbye(interaction, cfg, action) {
        const g = cfg.goodbye;
        if (action === 'toggle') { g.enabled = !g.enabled; return saveAnd(interaction, cfg, 'goodbye'); }
        if (action === 'channel') { g.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'goodbye'); }
        if (action === 'embed') { g.useEmbed = !g.useEmbed; return saveAnd(interaction, cfg, 'goodbye'); }
        if (action === 'msg') return showModal(interaction, 'setup:goodbye:msg_modal', 'Goodbye Message', [
            modalInput('message', 'Message', TextInputStyle.Paragraph, g.message, true),
            modalInput('color', 'Embed colour hex', TextInputStyle.Short, g.color, false),
        ]);
        if (action === 'test') {
            await sendGoodbye(interaction.member, cfg, true);
            return safeReply(interaction, '🧪 Sent a test goodbye.');
        }
    },

    async autorole(interaction, cfg, action) {
        const a = cfg.autorole;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'autorole'); }
        if (action === 'human') { a.humanRoleIds = interaction.values; return saveAnd(interaction, cfg, 'autorole'); }
        if (action === 'bot') { a.botRoleIds = interaction.values; return saveAnd(interaction, cfg, 'autorole'); }
    },

    async logging(interaction, cfg, action) {
        const l = cfg.logging;
        const key = `${interaction.guildId}:${interaction.user.id}`;
        if (action === 'toggle') { l.enabled = !l.enabled; return saveAnd(interaction, cfg, 'logging'); }
        if (action === 'pick') { pendingLog.set(key, interaction.values[0]); return interaction.deferUpdate(); }
        if (action === 'ignore') { l.ignoredChannelIds = interaction.values; return saveAnd(interaction, cfg, 'logging'); }
        if (action === 'channel') {
            const target = pendingLog.get(key) || 'memberLogId';
            l[target] = interaction.values[0];
            pendingLog.delete(key);
            return saveAnd(interaction, cfg, 'logging');
        }
    },

    // ---- Server lockdown --------------------------------------------------
    async serverlock(interaction, cfg, action) {
        const s = cfg.serverlock;
        if (action === 'reason') return showModal(interaction, 'setup:serverlock:reason_modal', 'Lockdown Reason', [
            modalInput('reason', 'Reason', TextInputStyle.Short, s.reason, true),
        ]);
        if (action === 'lock' || action === 'unlock') {
            await interaction.deferUpdate();
            const everyone = interaction.guild.roles.everyone;
            const lock = action === 'lock';
            const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
            const touched = [];
            for (const ch of channels.values()) {
                const ok = await ch.permissionOverwrites.edit(everyone, { SendMessages: lock ? false : null }, { reason: `Lockdown: ${s.reason}` }).then(() => true).catch(() => false);
                if (ok) touched.push(ch.id);
            }
            s.active = lock;
            s.lockedChannels = lock ? touched : [];
            cfg.markModified('serverlock'); await cfg.save();
            const announce = cfg.branding.modLogChannelId && interaction.guild.channels.cache.get(cfg.branding.modLogChannelId);
            if (announce) await announce.send(`${lock ? '🔒' : '🔓'} Server ${lock ? 'locked' : 'unlocked'} by ${interaction.user} (${touched.length} channels)${lock ? ` — ${s.reason}` : ''}.`).catch(() => null);
            return interaction.editReply(renderSection('serverlock', cfg));
        }
    },

    async verification(interaction, cfg, action) {
        const v = cfg.verification;
        if (action === 'toggle') { v.enabled = !v.enabled; return saveAnd(interaction, cfg, 'verification'); }
        if (action === 'role') { v.roleId = interaction.values[0]; return saveAnd(interaction, cfg, 'verification'); }
        if (action === 'channel') { v.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'verification'); }
        if (action === 'mode') { v.mode = v.mode === 'captcha' ? 'button' : 'captcha'; return saveAnd(interaction, cfg, 'verification'); }
        if (action === 'post') return postVerifyPanel(interaction, cfg);
    },

    async tickets(interaction, cfg, action) {
        const t = cfg.tickets;
        if (action === 'toggle') t.enabled = !t.enabled;
        if (action === 'category') t.categoryId = interaction.values[0];
        if (action === 'role1') t.staffRoleId = interaction.values[0];
        if (action === 'role2') t.staffRoleId2 = interaction.values[0] || null;
        if (action === 'log') t.logChannelId = interaction.values[0];
        // Mirror into the existing TicketConfig model so /ticket keeps working.
        await TicketConfig.findOneAndUpdate(
            { guildId: cfg.guildId },
            { guildId: cfg.guildId, staffRoleId: t.staffRoleId, staffRoleId2: t.staffRoleId2, categoryId: t.categoryId },
            { upsert: true },
        ).catch(() => null);
        return saveAnd(interaction, cfg, 'tickets');
    },

    async staffApps(interaction, cfg, action) {
        const s = cfg.staffApps;
        if (action === 'toggle') s.enabled = !s.enabled;
        if (action === 'category') s.categoryId = interaction.values[0];
        if (action === 'review') s.reviewRoleId = interaction.values[0];
        if (action === 'accepted') s.acceptedRoleId = interaction.values[0] || null;
        return saveAnd(interaction, cfg, 'staffApps');
    },

    async filter(interaction, cfg, action) {
        const f = cfg.filter;
        if (action === 'toggle') { f.enabled = !f.enabled; return saveAnd(interaction, cfg, 'filter'); }
        if (action === 'action') { f.action = interaction.values[0]; return saveAnd(interaction, cfg, 'filter'); }
        if (action === 'bypass') { f.whitelistRoleIds = interaction.values; return saveAnd(interaction, cfg, 'filter'); }
        if (action === 'log') { f.logChannelId = interaction.values[0]; return saveAnd(interaction, cfg, 'filter'); }
        if (action === 'words') return showModal(interaction, 'setup:filter:words_modal', 'Banned Words', [
            modalInput('words', 'One word per line (or comma-separated)', TextInputStyle.Paragraph, f.words.join('\n'), false),
            modalInput('timeoutMinutes', 'Timeout minutes (for timeout action)', TextInputStyle.Short, String(f.timeoutMinutes), false),
        ]);
    },

    async reactionRoles(interaction, cfg, action) {
        if (action === 'add') return showModal(interaction, 'setup:reactionRoles:add_modal', 'Add Reaction Role', [
            modalInput('channelId', 'Channel ID of the message', TextInputStyle.Short, '', true),
            modalInput('messageId', 'Message ID', TextInputStyle.Short, '', true),
            modalInput('pairs', 'Pairs: one per line as  emoji roleID', TextInputStyle.Paragraph, '⭐ 123456789012345678', true),
        ]);
        if (action === 'remove') {
            cfg.reactionRoles.splice(Number(interaction.values[0]), 1);
            return saveAnd(interaction, cfg, 'reactionRoles');
        }
        if (action === 'clear') { cfg.reactionRoles = []; return saveAnd(interaction, cfg, 'reactionRoles'); }
    },

    async autoresponders(interaction, cfg, action) {
        if (action === 'add') return showModal(interaction, 'setup:autoresponders:add_modal', 'Add Auto Responder', [
            modalInput('trigger', 'Trigger text', TextInputStyle.Short, '', true),
            modalInput('response', 'Response', TextInputStyle.Paragraph, '', true),
            modalInput('match', 'Match: contains | exact | startsWith', TextInputStyle.Short, 'contains', false),
        ]);
        if (action === 'remove') {
            cfg.autoresponders.splice(Number(interaction.values[0]), 1);
            return saveAnd(interaction, cfg, 'autoresponders');
        }
        if (action === 'clear') { cfg.autoresponders = []; return saveAnd(interaction, cfg, 'autoresponders'); }
    },

    async antispam(interaction, cfg, action) {
        const a = cfg.antispam;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'antispam'); }
        if (action === 'action') { a.action = interaction.values[0]; return saveAnd(interaction, cfg, 'antispam'); }
        if (action === 'limits') return showModal(interaction, 'setup:antispam:limits_modal', 'Anti-Spam Limits', [
            modalInput('maxMessages', 'Max messages', TextInputStyle.Short, String(a.maxMessages), true),
            modalInput('intervalSeconds', 'Per how many seconds', TextInputStyle.Short, String(a.intervalSeconds), true),
            modalInput('timeoutSeconds', 'Timeout length (seconds)', TextInputStyle.Short, String(a.timeoutSeconds), false),
        ]);
    },

    async antiraid(interaction, cfg, action) {
        const a = cfg.antiraid;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'antiraid'); }
        if (action === 'action') { a.action = interaction.values[0]; return saveAnd(interaction, cfg, 'antiraid'); }
        if (action === 'alert') { a.alertChannelId = interaction.values[0]; return saveAnd(interaction, cfg, 'antiraid'); }
        if (action === 'limits') return showModal(interaction, 'setup:antiraid:limits_modal', 'Anti-Raid Trigger', [
            modalInput('joinThreshold', 'Joins to trigger', TextInputStyle.Short, String(a.joinThreshold), true),
            modalInput('windowSeconds', 'Within how many seconds', TextInputStyle.Short, String(a.windowSeconds), true),
        ]);
    },

    async starboard(interaction, cfg, action) {
        const s = cfg.starboard;
        if (action === 'toggle') { s.enabled = !s.enabled; return saveAnd(interaction, cfg, 'starboard'); }
        if (action === 'channel') { s.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'starboard'); }
        if (action === 'settings') return showModal(interaction, 'setup:starboard:settings_modal', 'Starboard Settings', [
            modalInput('emoji', 'Emoji', TextInputStyle.Short, s.emoji, true),
            modalInput('threshold', 'Reactions needed', TextInputStyle.Short, String(s.threshold), true),
        ]);
    },

    async stats(interaction, cfg, action, arg, client) {
        const s = cfg.stats;
        if (action === 'toggle') { s.enabled = !s.enabled; return saveAnd(interaction, cfg, 'stats'); }
        if (action === 'member') { s.memberCountChannelId = interaction.values[0]; return saveAnd(interaction, cfg, 'stats'); }
        if (action === 'bot') { s.botCountChannelId = interaction.values[0]; return saveAnd(interaction, cfg, 'stats'); }
        if (action === 'templates') return showModal(interaction, 'setup:stats:templates_modal', 'Stat Templates', [
            modalInput('memberTemplate', 'Member template (use {count})', TextInputStyle.Short, s.memberTemplate, true),
            modalInput('botTemplate', 'Bot template (use {count})', TextInputStyle.Short, s.botTemplate, true),
        ]);
        if (action === 'refresh') { await refreshStats(interaction.guild, cfg); return safeReply(interaction, '🔄 Counters refreshed.'); }
    },

    async presence(interaction, cfg, action) {
        const p = cfg.presence;
        if (action === 'status') p.status = interaction.values[0];
        if (action === 'type') p.type = interaction.values[0];
        if (action === 'text') return showModal(interaction, 'setup:presence:text_modal', 'Activity Text', [
            modalInput('text', 'What the bot is doing', TextInputStyle.Short, p.text, true),
        ]);
        await applyPresence(interaction.client, p);
        await PresenceConfig.findOneAndUpdate({ key: 'global' }, { key: 'global', status: p.status, type: p.type, text: p.text }, { upsert: true }).catch(() => null);
        return saveAnd(interaction, cfg, 'presence');
    },

    // ---- Leveling ---------------------------------------------------------
    async leveling(interaction, cfg, action) {
        const l = cfg.leveling;
        if (action === 'toggle') { l.enabled = !l.enabled; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'stack') { l.stack = !l.stack; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'announce') { l.announceChannelId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'ignore') { l.ignoredChannelIds = interaction.values; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'clear_rewards') { l.rewards = []; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'reset') { l.users = []; return saveAnd(interaction, cfg, 'leveling'); }
        if (action === 'rates') return showModal(interaction, 'setup:leveling:rates_modal', 'XP Rates', [
            modalInput('xpPerMessage', 'XP per message', TextInputStyle.Short, String(l.xpPerMessage), true),
            modalInput('cooldownSeconds', 'Cooldown seconds', TextInputStyle.Short, String(l.cooldownSeconds), true),
            modalInput('multiplier', 'Global multiplier (e.g. 1.5)', TextInputStyle.Short, String(l.multiplier), false),
            modalInput('voiceXpPerMin', 'Voice XP per minute (0 = off)', TextInputStyle.Short, String(l.voiceXpPerMin), false),
        ]);
        if (action === 'reward') return showModal(interaction, 'setup:leveling:reward_modal', 'Level Reward', [
            modalInput('level', 'Level', TextInputStyle.Short, '', true),
            modalInput('roleId', 'Role ID', TextInputStyle.Short, '', true),
        ]);
        if (action === 'announce_msg') return showModal(interaction, 'setup:leveling:announce_modal', 'Level-Up Message', [
            modalInput('announceMessage', 'Use {user.mention} and {level}', TextInputStyle.Paragraph, l.announceMessage, true),
        ]);
    },

    // ---- Economy ----------------------------------------------------------
    async economy(interaction, cfg, action) {
        const e = cfg.economy;
        if (action === 'toggle') { e.enabled = !e.enabled; return saveAnd(interaction, cfg, 'economy'); }
        if (action === 'reset') { e.accounts = []; return saveAnd(interaction, cfg, 'economy'); }
        if (action === 'currency') return showModal(interaction, 'setup:economy:currency_modal', 'Currency', [
            modalInput('currencyName', 'Currency name', TextInputStyle.Short, e.currencyName, true),
            modalInput('symbol', 'Symbol / emoji', TextInputStyle.Short, e.symbol, true),
        ]);
        if (action === 'amounts') return showModal(interaction, 'setup:economy:amounts_modal', 'Economy Amounts', [
            modalInput('startingBalance', 'Starting balance', TextInputStyle.Short, String(e.startingBalance), true),
            modalInput('dailyAmount', 'Daily amount', TextInputStyle.Short, String(e.dailyAmount), true),
            modalInput('workMin', 'Work minimum', TextInputStyle.Short, String(e.workMin), true),
            modalInput('workMax', 'Work maximum', TextInputStyle.Short, String(e.workMax), true),
            modalInput('chatEarn', 'Coins per message', TextInputStyle.Short, String(e.chatEarn), false),
        ]);
        if (action === 'grant') return showModal(interaction, 'setup:economy:grant_modal', 'Give / Take Coins', [
            modalInput('userId', 'User ID', TextInputStyle.Short, '', true),
            modalInput('amount', 'Amount (negative to take)', TextInputStyle.Short, '', true),
        ]);
        if (action === 'panel') {
            const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle(`${e.symbol} ${e.currencyName[0].toUpperCase() + e.currencyName.slice(1)}`)
                .setDescription(`Earn ${e.symbol} by chatting, claiming your **daily**, and **working**. Spend it in the shop!`)
                .addFields(
                    { name: '📅 Daily', value: `${e.dailyAmount}`, inline: true },
                    { name: '💼 Work', value: `${e.workMin}–${e.workMax}`, inline: true },
                );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setpub:eco:daily').setLabel('Daily').setEmoji('📅').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setpub:eco:work').setLabel('Work').setEmoji('💼').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('setpub:eco:balance').setLabel('Balance').setEmoji('💰').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('setpub:eco:top').setLabel('Leaderboard').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
            );
            await interaction.channel.send({ embeds: [embed], components: [row] }).catch(() => null);
            return safeReply(interaction, '📨 Posted the economy member panel here.');
        }
    },

    // ---- Embed builder ----------------------------------------------------
    async embedbuilder(interaction, cfg, action) {
        const d = cfg.embedbuilder.draft;
        if (action === 'channel') { d.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'embedbuilder'); }
        if (action === 'clear') { cfg.embedbuilder.draft = { color: '#3b82f6' }; return saveAnd(interaction, cfg, 'embedbuilder'); }
        if (action === 'content') return showModal(interaction, 'setup:embedbuilder:content_modal', 'Embed Content', [
            modalInput('title', 'Title', TextInputStyle.Short, d.title || '', false),
            modalInput('description', 'Description', TextInputStyle.Paragraph, d.description || '', false),
        ]);
        if (action === 'media') return showModal(interaction, 'setup:embedbuilder:media_modal', 'Embed Media', [
            modalInput('image', 'Image URL', TextInputStyle.Short, d.image || '', false),
            modalInput('thumbnail', 'Thumbnail URL', TextInputStyle.Short, d.thumbnail || '', false),
            modalInput('footer', 'Footer text', TextInputStyle.Short, d.footer || '', false),
            modalInput('authorName', 'Author name', TextInputStyle.Short, d.authorName || '', false),
        ]);
        if (action === 'color') return showModal(interaction, 'setup:embedbuilder:color_modal', 'Embed Colour', [
            modalInput('color', 'Hex colour (e.g. #3b82f6)', TextInputStyle.Short, d.color, true),
        ]);
        if (action === 'save') return showModal(interaction, 'setup:embedbuilder:save_modal', 'Save Template', [
            modalInput('name', 'Template name', TextInputStyle.Short, '', true),
        ]);
        if (action === 'send') {
            if (!d.channelId) return safeReply(interaction, '❌ Choose a target channel first.');
            if (!d.title && !d.description) return safeReply(interaction, '❌ The embed needs a title or description.');
            const ch = interaction.guild.channels.cache.get(d.channelId);
            if (!ch) return safeReply(interaction, '❌ That channel no longer exists.');
            await ch.send({ embeds: [buildDraftEmbed(d)] }).catch(() => null);
            return safeReply(interaction, `📨 Embed sent to ${ch}.`);
        }
    },

    // ---- Suggestions ------------------------------------------------------
    async suggestions(interaction, cfg, action) {
        const s = cfg.suggestions;
        if (action === 'toggle') { s.enabled = !s.enabled; return saveAnd(interaction, cfg, 'suggestions'); }
        if (action === 'channel') { s.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'suggestions'); }
        if (action === 'anon') { s.anonymous = !s.anonymous; return saveAnd(interaction, cfg, 'suggestions'); }
        if (action === 'thread') { s.autoThread = !s.autoThread; return saveAnd(interaction, cfg, 'suggestions'); }
        if (action === 'emojis') return showModal(interaction, 'setup:suggestions:emojis_modal', 'Vote Emojis', [
            modalInput('upvote', 'Upvote emoji', TextInputStyle.Short, s.upvote, true),
            modalInput('downvote', 'Downvote emoji', TextInputStyle.Short, s.downvote, true),
        ]);
    },

    // ---- Self-role menus --------------------------------------------------
    async selfroles(interaction, cfg, action, arg) {
        const idx = Number(arg);
        if (action === 'new') return showModal(interaction, 'setup:selfroles:new_modal', 'New Self-Role Menu', [
            modalInput('title', 'Menu title', TextInputStyle.Short, 'Pick your roles', true),
        ]);
        if (action === 'pick') return update(interaction, PANELS._selfroleMenu(cfg, Number(interaction.values[0])));
        if (action === 'back') return update(interaction, PANELS.selfroles(cfg));
        if (action === 'addrole') {
            const m = cfg.selfroles.menus[idx];
            if (!m) return safeReply(interaction, '❌ Menu gone.');
            if (m.roles.length >= 5) return safeReply(interaction, '❌ Max 5 roles per menu.');
            const roleId = interaction.values[0];
            const role = interaction.guild.roles.cache.get(roleId);
            if (m.roles.some(r => r.roleId === roleId)) return safeReply(interaction, '❌ That role is already in the menu.');
            m.roles.push({ roleId, label: (role?.name || 'Role').slice(0, 40), emoji: '', style: 'Secondary' });
            cfg.markModified('selfroles'); await cfg.save();
            return update(interaction, PANELS._selfroleMenu(cfg, idx));
        }
        if (action === 'clearroles') { cfg.selfroles.menus[idx].roles = []; cfg.markModified('selfroles'); await cfg.save(); return update(interaction, PANELS._selfroleMenu(cfg, idx)); }
        if (action === 'delete') { cfg.selfroles.menus.splice(idx, 1); return saveAnd(interaction, cfg, 'selfroles'); }
        if (action === 'title') return showModal(interaction, `setup:selfroles:title_modal:${idx}`, 'Rename Menu', [
            modalInput('title', 'New title', TextInputStyle.Short, cfg.selfroles.menus[idx]?.title || '', true),
        ]);
        if (action === 'post') {
            const m = cfg.selfroles.menus[idx];
            if (!m || !m.roles.length) return safeReply(interaction, '❌ Add at least one role first.');
            const ch = interaction.guild.channels.cache.get(interaction.values[0]);
            if (!ch) return safeReply(interaction, '❌ Channel not found.');
            const sent = await ch.send(selfRoleMessage(m)).catch(() => null);
            if (!sent) return safeReply(interaction, '❌ Could not post (check my permissions).');
            m.messageId = sent.id; m.channelId = ch.id;
            cfg.markModified('selfroles'); await cfg.save();
            return update(interaction, PANELS._selfroleMenu(cfg, idx));
        }
    },

    // ---- Sticky -----------------------------------------------------------
    async sticky(interaction, cfg, action) {
        if (action === 'add') return showModal(interaction, 'setup:sticky:add_modal', 'Add Sticky Message', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('content', 'Sticky text', TextInputStyle.Paragraph, '', true),
            modalInput('every', 'Re-post after how many messages', TextInputStyle.Short, '5', false),
        ]);
        if (action === 'remove') { cfg.sticky.messages.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'sticky'); }
    },

    // ---- Link filter ------------------------------------------------------
    async linkfilter(interaction, cfg, action) {
        const f = cfg.linkfilter;
        if (action === 'toggle') f.enabled = !f.enabled;
        if (action === 'links') f.blockLinks = !f.blockLinks;
        if (action === 'invites') f.blockInvites = !f.blockInvites;
        if (action === 'action') f.action = f.action === 'warn' ? 'delete' : 'warn';
        if (action === 'roles') f.whitelistRoleIds = interaction.values;
        if (action === 'channels') f.whitelistChannelIds = interaction.values;
        return saveAnd(interaction, cfg, 'linkfilter');
    },

    // ---- Auto publish -----------------------------------------------------
    async autopublish(interaction, cfg, action) {
        const a = cfg.autopublish;
        if (action === 'toggle') a.enabled = !a.enabled;
        if (action === 'channels') a.channelIds = interaction.values;
        return saveAnd(interaction, cfg, 'autopublish');
    },

    // ---- Join gate --------------------------------------------------------
    async joingate(interaction, cfg, action) {
        const j = cfg.joingate;
        if (action === 'toggle') { j.enabled = !j.enabled; return saveAnd(interaction, cfg, 'joingate'); }
        if (action === 'alert') { j.alertChannelId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'joingate'); }
        if (action === 'action') { j.action = j.action === 'ban' ? 'kick' : 'ban'; return saveAnd(interaction, cfg, 'joingate'); }
        if (action === 'age') return showModal(interaction, 'setup:joingate:age_modal', 'Minimum Account Age', [
            modalInput('minAccountAgeDays', 'Days', TextInputStyle.Short, String(j.minAccountAgeDays), true),
        ]);
    },

    // ---- Birthdays --------------------------------------------------------
    async birthdays(interaction, cfg, action) {
        const b = cfg.birthdays;
        if (action === 'toggle') { b.enabled = !b.enabled; return saveAnd(interaction, cfg, 'birthdays'); }
        if (action === 'channel') { b.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'birthdays'); }
        if (action === 'role') { b.roleId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'birthdays'); }
        if (action === 'msg') return showModal(interaction, 'setup:birthdays:msg_modal', 'Birthday Message', [
            modalInput('message', 'Use {user.mention}', TextInputStyle.Paragraph, b.message, true),
        ]);
        if (action === 'panel') {
            const ch = b.channelId ? interaction.guild.channels.cache.get(b.channelId) : interaction.channel;
            const embed = new EmbedBuilder().setColor(0xec4899).setTitle('🎂 Register Your Birthday')
                .setDescription('Click below and enter your birthday (we only store the month and day) so we can celebrate you!');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('setpub:bday:open').setLabel('Set Birthday').setEmoji('🎂').setStyle(ButtonStyle.Success));
            await ch.send({ embeds: [embed], components: [row] }).catch(() => null);
            return safeReply(interaction, `📨 Posted the birthday register panel in ${ch}.`);
        }
    },

    // ---- Auto react -------------------------------------------------------
    async autoreact(interaction, cfg, action) {
        const a = cfg.autoreact;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'autoreact'); }
        if (action === 'remove') { a.rules.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'autoreact'); }
        if (action === 'add') return showModal(interaction, 'setup:autoreact:add_modal', 'Auto React Rule', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('emojis', 'Emojis (space-separated, max 5)', TextInputStyle.Short, '👍 👎', true),
        ]);
    },

    // ---- Mod tools --------------------------------------------------------
    async modtools(interaction, cfg, action) {
        const m = cfg.modtools;
        if (action === 'muterole') { m.muteRoleId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'modtools'); }
        if (action === 'dehoist') { m.dehoist = !m.dehoist; return saveAnd(interaction, cfg, 'modtools'); }
        if (action === 'mentionaction') { m.maxMentionsAction = m.maxMentionsAction === 'timeout' ? 'delete' : 'timeout'; return saveAnd(interaction, cfg, 'modtools'); }
        if (action === 'mentions') return showModal(interaction, 'setup:modtools:mentions_modal', 'Mention Limit', [
            modalInput('maxMentions', 'Max mentions per message (0 = off)', TextInputStyle.Short, String(m.maxMentions), true),
        ]);
    },

    // ---- Counting ---------------------------------------------------------
    async counting(interaction, cfg, action) {
        const c = cfg.counting;
        if (action === 'toggle') c.enabled = !c.enabled;
        if (action === 'channel') c.channelId = interaction.values[0];
        if (action === 'fail') c.resetOnFail = !c.resetOnFail;
        if (action === 'reset') { c.current = 0; c.lastUserId = null; }
        return saveAnd(interaction, cfg, 'counting');
    },

    // ---- Boost ------------------------------------------------------------
    async boost(interaction, cfg, action) {
        const b = cfg.boost;
        if (action === 'toggle') { b.enabled = !b.enabled; return saveAnd(interaction, cfg, 'boost'); }
        if (action === 'channel') { b.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'boost'); }
        if (action === 'msg') return showModal(interaction, 'setup:boost:msg_modal', 'Boost Message', [
            modalInput('message', 'Use {user.mention} and {server}', TextInputStyle.Paragraph, b.message, true),
        ]);
    },

    // ---- Dropdown roles ---------------------------------------------------
    async dropdownroles(interaction, cfg, action, arg) {
        const idx = Number(arg);
        if (action === 'new') return showModal(interaction, 'setup:dropdownroles:new_modal', 'New Dropdown Menu', [
            modalInput('title', 'Menu title', TextInputStyle.Short, 'Pick your roles', true),
            modalInput('placeholder', 'Menu placeholder', TextInputStyle.Short, 'Select roles…', false),
        ]);
        if (action === 'pick') return update(interaction, PANELS._dropdownMenu(cfg, Number(interaction.values[0])));
        if (action === 'back') return update(interaction, PANELS.dropdownroles(cfg));
        if (action === 'addrole') {
            const m = cfg.dropdownroles.menus[idx];
            if (!m) return safeReply(interaction, '❌ Menu gone.');
            if (m.roles.length >= 25) return safeReply(interaction, '❌ Max 25 roles per menu.');
            const roleId = interaction.values[0];
            if (m.roles.some(r => r.roleId === roleId)) return safeReply(interaction, '❌ Already added.');
            const role = interaction.guild.roles.cache.get(roleId);
            m.roles.push({ roleId, label: (role?.name || 'Role').slice(0, 40), emoji: '', description: '' });
            cfg.markModified('dropdownroles'); await cfg.save();
            return update(interaction, PANELS._dropdownMenu(cfg, idx));
        }
        if (action === 'clearroles') { cfg.dropdownroles.menus[idx].roles = []; cfg.markModified('dropdownroles'); await cfg.save(); return update(interaction, PANELS._dropdownMenu(cfg, idx)); }
        if (action === 'delete') { cfg.dropdownroles.menus.splice(idx, 1); return saveAnd(interaction, cfg, 'dropdownroles'); }
        if (action === 'range') return showModal(interaction, `setup:dropdownroles:range_modal:${idx}`, 'Pick Range', [
            modalInput('min', 'Minimum picks (0+)', TextInputStyle.Short, String(cfg.dropdownroles.menus[idx]?.min ?? 0), true),
            modalInput('max', 'Maximum picks', TextInputStyle.Short, String(cfg.dropdownroles.menus[idx]?.max ?? 1), true),
        ]);
        if (action === 'post') {
            const m = cfg.dropdownroles.menus[idx];
            if (!m || !m.roles.length) return safeReply(interaction, '❌ Add at least one role first.');
            const ch = interaction.guild.channels.cache.get(interaction.values[0]);
            if (!ch) return safeReply(interaction, '❌ Channel not found.');
            const sent = await ch.send(dropdownRoleMessage(m, idx)).catch(() => null);
            if (!sent) return safeReply(interaction, '❌ Could not post (check my permissions).');
            m.messageId = sent.id; m.channelId = ch.id;
            cfg.markModified('dropdownroles'); await cfg.save();
            return update(interaction, PANELS._dropdownMenu(cfg, idx));
        }
    },

    // ---- Sticky roles -----------------------------------------------------
    async stickyroles(interaction, cfg, action) {
        const s = cfg.stickyroles;
        if (action === 'toggle') s.enabled = !s.enabled;
        if (action === 'clear') s.store = [];
        return saveAnd(interaction, cfg, 'stickyroles');
    },

    // ---- Scheduled messages -----------------------------------------------
    async scheduled(interaction, cfg, action) {
        if (action === 'add') return showModal(interaction, 'setup:scheduled:add_modal', 'Add Scheduled Message', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('content', 'Message', TextInputStyle.Paragraph, '', true),
            modalInput('intervalMinutes', 'Every how many minutes', TextInputStyle.Short, '60', true),
        ]);
        if (action === 'remove') { cfg.scheduled.messages.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'scheduled'); }
        if (action === 'sendall') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            let sent = 0;
            for (const sm of cfg.scheduled.messages) {
                const ch = interaction.guild.channels.cache.get(sm.channelId);
                if (ch) { await ch.send(sm.embed ? { embeds: [new EmbedBuilder().setColor(ACCENT).setDescription(sm.content)] } : { content: sm.content.slice(0, 2000) }).catch(() => null); sm.lastRun = Date.now(); sent++; }
            }
            cfg.markModified('scheduled'); await cfg.save().catch(() => null);
            return interaction.editReply(`📨 Sent **${sent}** scheduled message(s) now.`);
        }
    },

    // ---- Temp voice -------------------------------------------------------
    async tempvoice(interaction, cfg, action) {
        const t = cfg.tempvoice;
        if (action === 'toggle') { t.enabled = !t.enabled; return saveAnd(interaction, cfg, 'tempvoice'); }
        if (action === 'hub') { t.hubChannelId = interaction.values[0]; return saveAnd(interaction, cfg, 'tempvoice'); }
        if (action === 'category') { t.categoryId = interaction.values[0]; return saveAnd(interaction, cfg, 'tempvoice'); }
        if (action === 'template') return showModal(interaction, 'setup:tempvoice:template_modal', 'Channel Name Template', [
            modalInput('nameTemplate', 'Use {user}', TextInputStyle.Short, t.nameTemplate, true),
        ]);
    },

    // ---- Ticket panel poster ----------------------------------------------
    async ticketpanel(interaction, cfg, action) {
        if (action === 'post') {
            const ch = interaction.guild.channels.cache.get(interaction.values[0]);
            if (!ch) return safeReply(interaction, '❌ Channel not found.');
            const embed = new EmbedBuilder().setColor(ACCENT).setTitle('🎫 Need help? Open a ticket')
                .setDescription('Choose a category below to open a private support ticket with the staff team.');
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('📂 Select a category…').addOptions(
                { label: 'General Support', value: 'General', emoji: '❓' },
                { label: 'Report a Player', value: 'Report', emoji: '🚨' },
                { label: 'Staff Application', value: 'Application', emoji: '📝' },
                { label: 'Billing / Donations', value: 'Billing', emoji: '💳' },
                { label: 'Other', value: 'Other', emoji: '📦' },
            );
            await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] }).catch(() => null);
            return safeReply(interaction, `📨 Ticket panel posted in ${ch}.`);
        }
    },

    // ---- Backup / Restore -------------------------------------------------
    async backup(interaction, cfg, action) {
        if (action === 'export') {
            const data = cfg.toObject();
            delete data._id; delete data.__v; delete data.guildId;
            // Strip bulky user-data arrays from the portable export.
            if (data.leveling) data.leveling.users = [];
            if (data.economy) data.economy.accounts = [];
            if (data.stickyroles) data.stickyroles.store = [];
            if (data.birthdays) data.birthdays.entries = [];
            if (data.warnings) data.warnings.records = [];
            const buf = Buffer.from(JSON.stringify(data, null, 2));
            return interaction.reply({ content: '📤 Here is your configuration export.', files: [{ attachment: buf, name: `ksrp-setup-${cfg.guildId}.json` }], ...ephemeral });
        }
        if (action === 'import') return showModal(interaction, 'setup:backup:import_modal', 'Import Configuration', [
            modalInput('json', 'Paste exported JSON', TextInputStyle.Paragraph, '', true),
        ]);
    },

    // ---- Auto threads -----------------------------------------------------
    async autothread(interaction, cfg, action) {
        const a = cfg.autothread;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'autothread'); }
        if (action === 'remove') { a.rules.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'autothread'); }
        if (action === 'add') return showModal(interaction, 'setup:autothread:add_modal', 'Auto Thread Rule', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('nameTemplate', 'Thread name template ({user})', TextInputStyle.Short, '{user}', false),
        ]);
    },

    // ---- Poll maker -------------------------------------------------------
    async pollmaker(interaction, cfg, action) {
        if (action === 'channel') { cfg.embedbuilder.draft.channelId = interaction.values[0]; return saveAnd(interaction, cfg, 'pollmaker'); }
        if (action === 'make') return showModal(interaction, 'setup:pollmaker:make_modal', 'Compose Poll', [
            modalInput('question', 'Question', TextInputStyle.Short, '', true),
            modalInput('options', 'Options — one per line (2-10)', TextInputStyle.Paragraph, '', true),
        ]);
    },

    // ---- Media-only -------------------------------------------------------
    async mediaonly(interaction, cfg, action) {
        const m = cfg.mediaonly;
        if (action === 'toggle') m.enabled = !m.enabled;
        if (action === 'channels') m.channelIds = interaction.values;
        if (action === 'links') m.allowLinks = !m.allowLinks;
        return saveAnd(interaction, cfg, 'mediaonly');
    },

    // ---- Warnings ---------------------------------------------------------
    async warnings(interaction, cfg, action) {
        const w = cfg.warnings;
        if (action === 'toggle') { w.enabled = !w.enabled; return saveAnd(interaction, cfg, 'warnings'); }
        if (action === 'log') { w.logChannelId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'warnings'); }
        if (action === 'clearactions') { w.autoActions = []; return saveAnd(interaction, cfg, 'warnings'); }
        if (action === 'clearrecords') { w.records = []; return saveAnd(interaction, cfg, 'warnings'); }
        if (action === 'warn') return showModal(interaction, 'setup:warnings:warn_modal', 'Warn a User', [
            modalInput('userId', 'User ID', TextInputStyle.Short, '', true),
            modalInput('reason', 'Reason', TextInputStyle.Paragraph, '', true),
        ]);
        if (action === 'autoaction') return showModal(interaction, 'setup:warnings:autoaction_modal', 'Warning Auto-Action', [
            modalInput('count', 'At how many warnings', TextInputStyle.Short, '3', true),
            modalInput('action', 'Action: timeout | kick | ban', TextInputStyle.Short, 'timeout', true),
            modalInput('durationMinutes', 'Timeout minutes (if timeout)', TextInputStyle.Short, '60', false),
        ]);
        if (action === 'view') return showModal(interaction, 'setup:warnings:view_modal', 'View User Warnings', [
            modalInput('userId', 'User ID', TextInputStyle.Short, '', true),
        ]);
    },

    // ---- Announce ping ----------------------------------------------------
    async announceping(interaction, cfg, action) {
        const a = cfg.announceping;
        if (action === 'toggle') { a.enabled = !a.enabled; return saveAnd(interaction, cfg, 'announceping'); }
        if (action === 'remove') { a.mappings.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'announceping'); }
        if (action === 'add') return showModal(interaction, 'setup:announceping:add_modal', 'Announce Ping Mapping', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('roleId', 'Role ID to ping', TextInputStyle.Short, '', true),
        ]);
    },

    // ---- Branding ---------------------------------------------------------
    async branding(interaction, cfg, action) {
        const b = cfg.branding;
        if (action === 'modlog') { b.modLogChannelId = interaction.values[0] || null; return saveAnd(interaction, cfg, 'branding'); }
        if (action === 'edit') return showModal(interaction, 'setup:branding:edit_modal', 'Edit Branding', [
            modalInput('displayName', 'Display name', TextInputStyle.Short, b.displayName || '', false),
            modalInput('accentColor', 'Accent colour hex', TextInputStyle.Short, b.accentColor, false),
            modalInput('supportInvite', 'Support server invite URL', TextInputStyle.Short, b.supportInvite || '', false),
        ]);
    },

    // ---- Economy shop -----------------------------------------------------
    async shop(interaction, cfg, action) {
        const s = cfg.shop;
        if (action === 'toggle') { s.enabled = !s.enabled; return saveAnd(interaction, cfg, 'shop'); }
        if (action === 'remove') { s.items.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'shop'); }
        if (action === 'add') return showModal(interaction, 'setup:shop:add_modal', 'Add Shop Item', [
            modalInput('name', 'Item name', TextInputStyle.Short, '', true),
            modalInput('price', 'Price', TextInputStyle.Short, '', true),
            modalInput('roleId', 'Role ID granted on purchase', TextInputStyle.Short, '', true),
            modalInput('description', 'Description', TextInputStyle.Short, '', false),
        ]);
        if (action === 'post') {
            if (!s.items.length) return safeReply(interaction, '❌ Add at least one item first.');
            const ch = interaction.channel;
            const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🛒 Role Shop')
                .setDescription(s.items.map((it, i) => `**${i + 1}. ${it.name}** — ${cfg.economy.symbol} ${it.price}\n${it.description || ''} → <@&${it.roleId}>`).join('\n\n'));
            const select = new StringSelectMenuBuilder().setCustomId('setpub:shop:buy').setPlaceholder('🛒 Buy an item…')
                .addOptions(s.items.slice(0, 25).map((it, i) => ({ label: `${it.name} (${it.price})`.slice(0, 90), value: String(i), description: (it.description || '').slice(0, 90) })));
            await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] }).catch(() => null);
            return safeReply(interaction, `📨 Shop posted in ${ch}.`);
        }
    },

    // ---- Auto purge -------------------------------------------------------
    async autopurge(interaction, cfg, action) {
        if (action === 'remove') { cfg.autopurge.tasks.splice(Number(interaction.values[0]), 1); return saveAnd(interaction, cfg, 'autopurge'); }
        if (action === 'now') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            let total = 0;
            for (const task of cfg.autopurge.tasks) {
                const ch = interaction.guild.channels.cache.get(task.channelId);
                if (!ch?.messages) continue;
                const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
                if (!msgs) continue;
                const del = msgs.filter(m => (!task.keepPinned || !m.pinned) && (Date.now() - m.createdTimestamp) < 14 * 86400000);
                if (del.size) { const done = await ch.bulkDelete(del, true).catch(() => null); total += done?.size || 0; }
                task.lastRun = Date.now();
            }
            cfg.markModified('autopurge'); await cfg.save().catch(() => null);
            return interaction.editReply(`🧽 Purged **${total}** message(s) across ${cfg.autopurge.tasks.length} task(s).`);
        }
        if (action === 'add') return showModal(interaction, 'setup:autopurge:add_modal', 'Add Purge Task', [
            modalInput('channelId', 'Channel ID', TextInputStyle.Short, '', true),
            modalInput('everyHours', 'Purge every how many hours', TextInputStyle.Short, '24', true),
            modalInput('keepPinned', 'Keep pinned? (yes/no)', TextInputStyle.Short, 'yes', false),
        ]);
    },

    // ---- Mass role --------------------------------------------------------
    async massrole(interaction, cfg, action) {
        const key = `${interaction.guildId}:${interaction.user.id}`;
        if (action === 'role') { pendingRole.set(key, interaction.values[0]); return interaction.deferUpdate(); }
        const roleId = pendingRole.get(key);
        if (!roleId) return safeReply(interaction, '❌ Pick a role from the menu first.');
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return safeReply(interaction, '❌ That role no longer exists.');
        if (role.position >= interaction.guild.members.me.roles.highest.position) return safeReply(interaction, '❌ That role is above my highest role — I can\'t manage it.');
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const members = await interaction.guild.members.fetch().catch(() => null);
        if (!members) return interaction.editReply('❌ Could not fetch the member list.');
        let changed = 0;
        for (const m of members.values()) {
            if (action === 'humans' && m.user.bot) continue;
            if (action === 'removeall') { if (m.roles.cache.has(roleId)) { await m.roles.remove(roleId).catch(() => null); changed++; } }
            else { if (!m.roles.cache.has(roleId)) { await m.roles.add(roleId).catch(() => null); changed++; } }
        }
        const verb = action === 'removeall' ? 'Removed from' : 'Added to';
        return interaction.editReply(`👥 ${verb} **${changed}** member(s) for ${role}.`);
    },

    // ---- Invite tracker ---------------------------------------------------
    async invites(interaction, cfg, action) {
        const i = cfg.invites;
        if (action === 'toggle') i.enabled = !i.enabled;
        if (action === 'channel') i.channelId = interaction.values[0] || null;
        if (action === 'reset') i.counts = [];
        return saveAnd(interaction, cfg, 'invites');
    },

    // ---- Diagnostics ------------------------------------------------------
    async diagnostics(interaction, cfg, action) {
        if (action === 'run') return interaction.reply({ embeds: [diagnosticsReport(interaction.guild, cfg)], ...ephemeral });
    },

    // ---- Nickname filter --------------------------------------------------
    async nickfilter(interaction, cfg, action) {
        const n = cfg.nickfilter;
        if (action === 'toggle') { n.enabled = !n.enabled; return saveAnd(interaction, cfg, 'nickfilter'); }
        if (action === 'action') { n.action = n.action === 'kick' ? 'rename' : 'kick'; return saveAnd(interaction, cfg, 'nickfilter'); }
        if (action === 'words') return showModal(interaction, 'setup:nickfilter:words_modal', 'Banned Nickname Words', [
            modalInput('words', 'One per line or comma-separated', TextInputStyle.Paragraph, n.words.join('\n'), false),
        ]);
    },
};

// ----------------------------------------------------------------------------
// 7. MODALS
// ----------------------------------------------------------------------------

function modalInput(id, label, style, value = '', required = false) {
    const input = new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(style).setRequired(required);
    if (value) input.setValue(String(value).slice(0, 4000));
    return input;
}
function showModal(interaction, customId, title, inputs) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
    modal.addComponents(...inputs.map(i => new ActionRowBuilder().addComponents(i)));
    return interaction.showModal(modal);
}
const field = (interaction, id) => { try { return interaction.fields.getTextInputValue(id); } catch { return ''; } };

async function handleModal(interaction, section, action) {
    const cfg = await getConfig(interaction.guildId);

    if (section === 'welcome' && action === 'msg_modal') {
        cfg.welcome.message = field(interaction, 'message') || cfg.welcome.message;
        cfg.welcome.dmMessage = field(interaction, 'dmMessage') || cfg.welcome.dmMessage;
        const c = field(interaction, 'color'); if (/^#?[0-9a-f]{6}$/i.test(c)) cfg.welcome.color = c.startsWith('#') ? c : `#${c}`;
        return saveAnd(interaction, cfg, 'welcome');
    }
    if (section === 'welcome' && action === 'image_modal') {
        const url = field(interaction, 'imageUrl').trim();
        cfg.welcome.imageUrl = url || null;
        return saveAnd(interaction, cfg, 'welcome');
    }
    if (section === 'goodbye' && action === 'msg_modal') {
        cfg.goodbye.message = field(interaction, 'message') || cfg.goodbye.message;
        const c = field(interaction, 'color'); if (/^#?[0-9a-f]{6}$/i.test(c)) cfg.goodbye.color = c.startsWith('#') ? c : `#${c}`;
        return saveAnd(interaction, cfg, 'goodbye');
    }
    if (section === 'filter' && action === 'words_modal') {
        const raw = field(interaction, 'words');
        cfg.filter.words = raw.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
        const t = parseInt(field(interaction, 'timeoutMinutes'), 10); if (!isNaN(t) && t > 0) cfg.filter.timeoutMinutes = t;
        return saveAnd(interaction, cfg, 'filter');
    }
    if (section === 'reactionRoles' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const messageId = field(interaction, 'messageId').replace(/\D/g, '');
        const pairs = field(interaction, 'pairs').split('\n').map(line => {
            const m = line.trim().match(/^(\S+)\s+(\d{17,20})$/);
            return m ? { emoji: m[1], roleId: m[2] } : null;
        }).filter(Boolean);
        if (!channelId || !messageId || !pairs.length) return safeReply(interaction, '❌ Need a valid channel ID, message ID and at least one `emoji roleID` line.');
        cfg.reactionRoles.push({ channelId, messageId, pairs });
        // React on the target message so users can click.
        const ch = interaction.guild.channels.cache.get(channelId);
        const msg = ch && await ch.messages.fetch(messageId).catch(() => null);
        if (msg) for (const p of pairs) await msg.react(p.emoji).catch(() => null);
        return saveAnd(interaction, cfg, 'reactionRoles');
    }
    if (section === 'autoresponders' && action === 'add_modal') {
        const trigger = field(interaction, 'trigger').trim();
        const response = field(interaction, 'response').trim();
        let match = field(interaction, 'match').trim().toLowerCase();
        if (!['contains', 'exact', 'startswith'].includes(match)) match = 'contains';
        if (!trigger || !response) return safeReply(interaction, '❌ Trigger and response are both required.');
        cfg.autoresponders.push({ trigger, response, match });
        return saveAnd(interaction, cfg, 'autoresponders');
    }
    if (section === 'antispam' && action === 'limits_modal') {
        const a = cfg.antispam;
        a.maxMessages = clampInt(field(interaction, 'maxMessages'), a.maxMessages, 2, 30);
        a.intervalSeconds = clampInt(field(interaction, 'intervalSeconds'), a.intervalSeconds, 1, 60);
        a.timeoutSeconds = clampInt(field(interaction, 'timeoutSeconds'), a.timeoutSeconds, 5, 3600);
        return saveAnd(interaction, cfg, 'antispam');
    }
    if (section === 'antiraid' && action === 'limits_modal') {
        const a = cfg.antiraid;
        a.joinThreshold = clampInt(field(interaction, 'joinThreshold'), a.joinThreshold, 2, 100);
        a.windowSeconds = clampInt(field(interaction, 'windowSeconds'), a.windowSeconds, 2, 120);
        return saveAnd(interaction, cfg, 'antiraid');
    }
    if (section === 'starboard' && action === 'settings_modal') {
        cfg.starboard.emoji = field(interaction, 'emoji').trim() || '⭐';
        cfg.starboard.threshold = clampInt(field(interaction, 'threshold'), cfg.starboard.threshold, 1, 50);
        return saveAnd(interaction, cfg, 'starboard');
    }
    if (section === 'stats' && action === 'templates_modal') {
        cfg.stats.memberTemplate = field(interaction, 'memberTemplate') || cfg.stats.memberTemplate;
        cfg.stats.botTemplate = field(interaction, 'botTemplate') || cfg.stats.botTemplate;
        return saveAnd(interaction, cfg, 'stats');
    }
    if (section === 'presence' && action === 'text_modal') {
        cfg.presence.text = field(interaction, 'text') || cfg.presence.text;
        const p = cfg.presence;
        await applyPresence(interaction.client, p);
        await PresenceConfig.findOneAndUpdate({ key: 'global' }, { key: 'global', status: p.status, type: p.type, text: p.text }, { upsert: true }).catch(() => null);
        return saveAnd(interaction, cfg, 'presence');
    }
    // ---- Leveling ----
    if (section === 'leveling' && action === 'rates_modal') {
        const l = cfg.leveling;
        l.xpPerMessage = clampInt(field(interaction, 'xpPerMessage'), l.xpPerMessage, 1, 1000);
        l.cooldownSeconds = clampInt(field(interaction, 'cooldownSeconds'), l.cooldownSeconds, 0, 3600);
        l.voiceXpPerMin = clampInt(field(interaction, 'voiceXpPerMin'), l.voiceXpPerMin, 0, 1000);
        const mult = parseFloat(field(interaction, 'multiplier')); if (!isNaN(mult) && mult > 0) l.multiplier = Math.min(10, mult);
        return saveAnd(interaction, cfg, 'leveling');
    }
    if (section === 'leveling' && action === 'reward_modal') {
        const level = clampInt(field(interaction, 'level'), 0, 1, 1000);
        const roleId = field(interaction, 'roleId').replace(/\D/g, '');
        if (!level || !roleId) return safeReply(interaction, '❌ Need a level and a role ID.');
        cfg.leveling.rewards = cfg.leveling.rewards.filter(r => r.level !== level);
        cfg.leveling.rewards.push({ level, roleId });
        return saveAnd(interaction, cfg, 'leveling');
    }
    if (section === 'leveling' && action === 'announce_modal') {
        cfg.leveling.announceMessage = field(interaction, 'announceMessage') || cfg.leveling.announceMessage;
        return saveAnd(interaction, cfg, 'leveling');
    }

    // ---- Economy ----
    if (section === 'economy' && action === 'currency_modal') {
        cfg.economy.currencyName = field(interaction, 'currencyName') || cfg.economy.currencyName;
        cfg.economy.symbol = field(interaction, 'symbol') || cfg.economy.symbol;
        return saveAnd(interaction, cfg, 'economy');
    }
    if (section === 'economy' && action === 'amounts_modal') {
        const e = cfg.economy;
        e.startingBalance = clampInt(field(interaction, 'startingBalance'), e.startingBalance, 0, 1e9);
        e.dailyAmount = clampInt(field(interaction, 'dailyAmount'), e.dailyAmount, 0, 1e9);
        e.workMin = clampInt(field(interaction, 'workMin'), e.workMin, 0, 1e9);
        e.workMax = clampInt(field(interaction, 'workMax'), e.workMax, e.workMin, 1e9);
        e.chatEarn = clampInt(field(interaction, 'chatEarn'), e.chatEarn, 0, 1000);
        return saveAnd(interaction, cfg, 'economy');
    }
    if (section === 'economy' && action === 'grant_modal') {
        const userId = field(interaction, 'userId').replace(/\D/g, '');
        const amount = parseInt(field(interaction, 'amount'), 10);
        if (!userId || isNaN(amount)) return safeReply(interaction, '❌ Need a user ID and a numeric amount.');
        const acc = ecoAccount(cfg, userId);
        acc.balance = Math.max(0, acc.balance + amount);
        cfg.markModified('economy'); await cfg.save();
        return safeReply(interaction, `✅ <@${userId}> now has ${cfg.economy.symbol} **${acc.balance}**.`);
    }

    // ---- Embed builder ----
    if (section === 'embedbuilder' && action === 'content_modal') {
        cfg.embedbuilder.draft.title = field(interaction, 'title') || null;
        cfg.embedbuilder.draft.description = field(interaction, 'description') || null;
        return saveAnd(interaction, cfg, 'embedbuilder');
    }
    if (section === 'embedbuilder' && action === 'media_modal') {
        const d = cfg.embedbuilder.draft;
        d.image = field(interaction, 'image').trim() || null;
        d.thumbnail = field(interaction, 'thumbnail').trim() || null;
        d.footer = field(interaction, 'footer') || null;
        d.authorName = field(interaction, 'authorName') || null;
        return saveAnd(interaction, cfg, 'embedbuilder');
    }
    if (section === 'embedbuilder' && action === 'color_modal') {
        const c = field(interaction, 'color').trim();
        if (/^#?[0-9a-f]{6}$/i.test(c)) cfg.embedbuilder.draft.color = c.startsWith('#') ? c : `#${c}`;
        return saveAnd(interaction, cfg, 'embedbuilder');
    }
    if (section === 'embedbuilder' && action === 'save_modal') {
        const name = field(interaction, 'name').trim();
        if (!name) return safeReply(interaction, '❌ Name required.');
        const data = JSON.parse(JSON.stringify(cfg.embedbuilder.draft));
        cfg.embedbuilder.saved = cfg.embedbuilder.saved.filter(t => t.name !== name);
        cfg.embedbuilder.saved.push({ name, data });
        return saveAnd(interaction, cfg, 'embedbuilder');
    }

    // ---- Suggestions ----
    if (section === 'suggestions' && action === 'emojis_modal') {
        cfg.suggestions.upvote = field(interaction, 'upvote').trim() || '👍';
        cfg.suggestions.downvote = field(interaction, 'downvote').trim() || '👎';
        return saveAnd(interaction, cfg, 'suggestions');
    }

    // ---- Self-roles ----
    if (section === 'selfroles' && action === 'new_modal') {
        const title = field(interaction, 'title').trim() || 'Pick your roles';
        cfg.selfroles.menus.push({ title, roles: [], messageId: null, channelId: null });
        cfg.markModified('selfroles'); await cfg.save();
        return update(interaction, PANELS._selfroleMenu(cfg, cfg.selfroles.menus.length - 1));
    }
    if (section === 'selfroles' && action === 'title_modal') {
        const idx = Number(interaction.customId.split(':')[3]);
        if (cfg.selfroles.menus[idx]) cfg.selfroles.menus[idx].title = field(interaction, 'title').trim() || cfg.selfroles.menus[idx].title;
        cfg.markModified('selfroles'); await cfg.save();
        return update(interaction, PANELS._selfroleMenu(cfg, idx));
    }

    // ---- Sticky ----
    if (section === 'sticky' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const content = field(interaction, 'content').trim();
        const every = clampInt(field(interaction, 'every'), 5, 1, 100);
        if (!channelId || !content) return safeReply(interaction, '❌ Channel ID and text required.');
        cfg.sticky.messages.push({ channelId, content, lastMessageId: null, counter: 0, every });
        return saveAnd(interaction, cfg, 'sticky');
    }

    // ---- Join gate ----
    if (section === 'joingate' && action === 'age_modal') {
        cfg.joingate.minAccountAgeDays = clampInt(field(interaction, 'minAccountAgeDays'), cfg.joingate.minAccountAgeDays, 0, 3650);
        return saveAnd(interaction, cfg, 'joingate');
    }

    // ---- Birthdays ----
    if (section === 'birthdays' && action === 'msg_modal') {
        cfg.birthdays.message = field(interaction, 'message') || cfg.birthdays.message;
        return saveAnd(interaction, cfg, 'birthdays');
    }

    // ---- Auto react ----
    if (section === 'autoreact' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const emojis = field(interaction, 'emojis').trim().split(/\s+/).filter(Boolean).slice(0, 5);
        if (!channelId || !emojis.length) return safeReply(interaction, '❌ Channel ID and at least one emoji required.');
        cfg.autoreact.rules.push({ channelId, emojis });
        return saveAnd(interaction, cfg, 'autoreact');
    }

    // ---- Mod tools ----
    if (section === 'modtools' && action === 'mentions_modal') {
        cfg.modtools.maxMentions = clampInt(field(interaction, 'maxMentions'), cfg.modtools.maxMentions, 0, 50);
        return saveAnd(interaction, cfg, 'modtools');
    }

    // ---- Boost ----
    if (section === 'boost' && action === 'msg_modal') {
        cfg.boost.message = field(interaction, 'message') || cfg.boost.message;
        return saveAnd(interaction, cfg, 'boost');
    }

    // ---- Dropdown roles ----
    if (section === 'dropdownroles' && action === 'new_modal') {
        cfg.dropdownroles.menus.push({
            title: field(interaction, 'title').trim() || 'Pick your roles',
            placeholder: field(interaction, 'placeholder').trim() || 'Select roles…',
            min: 0, max: 1, roles: [], messageId: null, channelId: null,
        });
        cfg.markModified('dropdownroles'); await cfg.save();
        return update(interaction, PANELS._dropdownMenu(cfg, cfg.dropdownroles.menus.length - 1));
    }
    if (section === 'dropdownroles' && action === 'range_modal') {
        const idx = Number(interaction.customId.split(':')[3]);
        const m = cfg.dropdownroles.menus[idx];
        if (m) {
            m.min = clampInt(field(interaction, 'min'), 0, 0, m.roles.length || 25);
            m.max = clampInt(field(interaction, 'max'), 1, Math.max(1, m.min), m.roles.length || 25);
        }
        cfg.markModified('dropdownroles'); await cfg.save();
        return update(interaction, PANELS._dropdownMenu(cfg, idx));
    }

    // ---- Scheduled ----
    if (section === 'scheduled' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const content = field(interaction, 'content').trim();
        const intervalMinutes = clampInt(field(interaction, 'intervalMinutes'), 60, 1, 10080);
        if (!channelId || !content) return safeReply(interaction, '❌ Channel ID and message required.');
        cfg.scheduled.messages.push({ channelId, content, intervalMinutes, lastRun: 0, embed: false });
        return saveAnd(interaction, cfg, 'scheduled');
    }

    // ---- Temp voice ----
    if (section === 'tempvoice' && action === 'template_modal') {
        cfg.tempvoice.nameTemplate = field(interaction, 'nameTemplate') || cfg.tempvoice.nameTemplate;
        return saveAnd(interaction, cfg, 'tempvoice');
    }

    // ---- Auto threads ----
    if (section === 'autothread' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        if (!channelId) return safeReply(interaction, '❌ Channel ID required.');
        cfg.autothread.rules.push({ channelId, nameTemplate: field(interaction, 'nameTemplate').trim() || '{user}' });
        return saveAnd(interaction, cfg, 'autothread');
    }

    // ---- Poll maker ----
    if (section === 'pollmaker' && action === 'make_modal') {
        const channelId = cfg.embedbuilder.draft.channelId;
        if (!channelId) return safeReply(interaction, '❌ Choose a channel on the poll panel first.');
        const ch = interaction.guild.channels.cache.get(channelId);
        if (!ch) return safeReply(interaction, '❌ That channel no longer exists.');
        const question = field(interaction, 'question').trim();
        const options = field(interaction, 'options').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 10);
        if (options.length < 2) return safeReply(interaction, '❌ Provide at least 2 options.');
        const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📊 ' + question)
            .setDescription(options.map((o, i) => `${NUM[i]} ${o}`).join('\n\n'))
            .setFooter({ text: `Poll by ${interaction.user.tag}` });
        const sent = await ch.send({ embeds: [embed] }).catch(() => null);
        if (sent) for (let i = 0; i < options.length; i++) await sent.react(NUM[i]).catch(() => null);
        return safeReply(interaction, `📊 Poll posted in ${ch}.`);
    }

    // ---- Media-only (handled via selects/buttons; no modal) ----

    // ---- Warnings ----
    if (section === 'warnings' && action === 'warn_modal') {
        const userId = field(interaction, 'userId').replace(/\D/g, '');
        const reason = field(interaction, 'reason').trim() || 'No reason given';
        if (!userId) return safeReply(interaction, '❌ Valid user ID required.');
        cfg.warnings.records.push({ userId, reason, modId: interaction.user.id, time: Date.now() });
        const count = cfg.warnings.records.filter(r => r.userId === userId).length;
        cfg.markModified('warnings'); await cfg.save();
        if (cfg.warnings.logChannelId) {
            const ch = interaction.guild.channels.cache.get(cfg.warnings.logChannelId);
            if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(`⚠️ <@${userId}> warned by ${interaction.user} (now **${count}**)\n**Reason:** ${reason}`).setTimestamp()] }).catch(() => null);
        }
        // Apply the highest matching auto-action.
        const act = cfg.warnings.autoActions.filter(a => a.count <= count).sort((a, b) => b.count - a.count)[0];
        if (act) {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) {
                if (act.action === 'ban') await member.ban({ reason: `Reached ${count} warnings` }).catch(() => null);
                else if (act.action === 'kick') await member.kick(`Reached ${count} warnings`).catch(() => null);
                else if (act.action === 'timeout' && member.moderatable) await member.timeout((act.durationMinutes || 60) * 60000, `Reached ${count} warnings`).catch(() => null);
            }
        }
        return safeReply(interaction, `⚠️ Warned <@${userId}> — they now have **${count}** warning(s).${act ? ` Auto-action: \`${act.action}\`.` : ''}`);
    }
    if (section === 'warnings' && action === 'view_modal') {
        const userId = field(interaction, 'userId').replace(/\D/g, '');
        const recs = cfg.warnings.records.filter(r => r.userId === userId);
        if (!recs.length) return safeReply(interaction, `✅ <@${userId}> has no warnings.`);
        const list = recs.slice(-10).map((r, i) => `**${i + 1}.** ${r.reason} — by <@${r.modId}> <t:${Math.floor(r.time / 1000)}:R>`).join('\n');
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle(`⚠️ ${recs.length} warning(s)`).setDescription(`For <@${userId}>:\n${list}`)], ...ephemeral });
    }
    if (section === 'warnings' && action === 'autoaction_modal') {
        const count = clampInt(field(interaction, 'count'), 0, 1, 100);
        let act = field(interaction, 'action').trim().toLowerCase();
        if (!['timeout', 'kick', 'ban'].includes(act)) act = 'timeout';
        const durationMinutes = clampInt(field(interaction, 'durationMinutes'), 60, 1, 40320);
        if (!count) return safeReply(interaction, '❌ Need a warning count.');
        cfg.warnings.autoActions = cfg.warnings.autoActions.filter(a => a.count !== count);
        cfg.warnings.autoActions.push({ count, action: act, durationMinutes });
        return saveAnd(interaction, cfg, 'warnings');
    }

    // ---- Announce ping ----
    if (section === 'announceping' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const roleId = field(interaction, 'roleId').replace(/\D/g, '');
        if (!channelId || !roleId) return safeReply(interaction, '❌ Channel ID and role ID required.');
        cfg.announceping.mappings.push({ channelId, roleId });
        return saveAnd(interaction, cfg, 'announceping');
    }

    // ---- Branding ----
    if (section === 'branding' && action === 'edit_modal') {
        const b = cfg.branding;
        b.displayName = field(interaction, 'displayName').trim() || null;
        const c = field(interaction, 'accentColor').trim(); if (/^#?[0-9a-f]{6}$/i.test(c)) b.accentColor = c.startsWith('#') ? c : `#${c}`;
        b.supportInvite = field(interaction, 'supportInvite').trim() || null;
        return saveAnd(interaction, cfg, 'branding');
    }

    // ---- Economy shop ----
    if (section === 'shop' && action === 'add_modal') {
        const name = field(interaction, 'name').trim();
        const price = clampInt(field(interaction, 'price'), 0, 0, 1e9);
        const roleId = field(interaction, 'roleId').replace(/\D/g, '');
        if (!name || !roleId) return safeReply(interaction, '❌ Name and role ID required.');
        cfg.shop.items.push({ name, price, roleId, description: field(interaction, 'description').trim() });
        return saveAnd(interaction, cfg, 'shop');
    }

    // ---- Auto purge ----
    if (section === 'autopurge' && action === 'add_modal') {
        const channelId = field(interaction, 'channelId').replace(/\D/g, '');
        const everyHours = clampInt(field(interaction, 'everyHours'), 24, 1, 720);
        const keepPinned = /^y/i.test(field(interaction, 'keepPinned').trim());
        if (!channelId) return safeReply(interaction, '❌ Channel ID required.');
        cfg.autopurge.tasks.push({ channelId, everyHours, lastRun: Date.now(), keepPinned });
        return saveAnd(interaction, cfg, 'autopurge');
    }

    // ---- Nickname filter ----
    if (section === 'nickfilter' && action === 'words_modal') {
        cfg.nickfilter.words = field(interaction, 'words').split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
        return saveAnd(interaction, cfg, 'nickfilter');
    }

    // ---- Server lockdown ----
    if (section === 'serverlock' && action === 'reason_modal') {
        cfg.serverlock.reason = field(interaction, 'reason').trim() || cfg.serverlock.reason;
        return saveAnd(interaction, cfg, 'serverlock');
    }

    // ---- Backup import ----
    if (section === 'backup' && action === 'import_modal') {
        let data;
        try { data = JSON.parse(field(interaction, 'json')); }
        catch { return safeReply(interaction, '❌ That is not valid JSON.'); }
        if (!data || typeof data !== 'object') return safeReply(interaction, '❌ Invalid configuration.');
        // Merge known top-level config keys; never overwrite identity/user data.
        const skip = new Set(['_id', '__v', 'guildId']);
        for (const key of Object.keys(data)) {
            if (skip.has(key)) continue;
            if (key in cfg.schema.paths || cfg.schema.nested?.[key] || cfg[key] !== undefined) { cfg[key] = data[key]; cfg.markModified(key); }
        }
        await cfg.save().catch(() => null);
        return update(interaction, homePanel(cfg));
    }

    return safeReply(interaction, '⚠️ Unhandled modal.');
}

// Dropdown-role posted message: a select menu users choose roles from.
function dropdownRoleMessage(menu, idx) {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle(menu.title)
        .setDescription(menu.roles.map(r => `${r.emoji || '•'} <@&${r.roleId}>`).join('\n') || 'No roles');
    const select = new StringSelectMenuBuilder()
        .setCustomId(`setpub:droles:${idx}`)
        .setPlaceholder(menu.placeholder || 'Select roles…')
        .setMinValues(Math.min(menu.min, menu.roles.length))
        .setMaxValues(Math.max(1, Math.min(menu.max, menu.roles.length)))
        .addOptions(menu.roles.map(r => {
            const o = { label: r.label || 'Role', value: r.roleId };
            if (r.emoji) o.emoji = r.emoji;
            if (r.description) o.description = r.description.slice(0, 90);
            return o;
        }));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

// Helpers shared by the embed builder, self-roles and economy/leveling.
function buildDraftEmbed(d) {
    const e = new EmbedBuilder().setColor(parseColor(d.color));
    if (d.title) e.setTitle(d.title);
    if (d.description) e.setDescription(d.description);
    if (d.image) e.setImage(d.image);
    if (d.thumbnail) e.setThumbnail(d.thumbnail);
    if (d.footer) e.setFooter({ text: d.footer });
    if (d.authorName) e.setAuthor({ name: d.authorName });
    return e;
}
const STYLE_MAP = { Primary: ButtonStyle.Primary, Secondary: ButtonStyle.Secondary, Success: ButtonStyle.Success, Danger: ButtonStyle.Danger };
function selfRoleMessage(menu) {
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle(menu.title)
        .setDescription(menu.roles.map(r => `${r.emoji || '•'} <@&${r.roleId}>`).join('\n') || 'No roles');
    const row = new ActionRowBuilder().addComponents(menu.roles.slice(0, 5).map(r => {
        const b = new ButtonBuilder().setCustomId(`setpub:selfrole:${r.roleId}`).setLabel(r.label || 'Role').setStyle(STYLE_MAP[r.style] || ButtonStyle.Secondary);
        if (r.emoji) b.setEmoji(r.emoji);
        return b;
    }));
    return { embeds: [embed], components: [row] };
}
function ecoAccount(cfg, userId) {
    let acc = cfg.economy.accounts.find(a => a.userId === userId);
    if (!acc) { acc = { userId, balance: cfg.economy.startingBalance, lastDaily: 0, lastWork: 0 }; cfg.economy.accounts.push(acc); }
    return acc;
}
function levelUser(cfg, userId) {
    let u = cfg.leveling.users.find(x => x.userId === userId);
    if (!u) { u = { userId, xp: 0, level: 0 }; cfg.leveling.users.push(u); }
    return u;
}
// XP required to reach a given level (gentle quadratic curve).
const xpForLevel = level => 5 * level * level + 50 * level + 100;

const clampInt = (raw, fallback, min, max) => {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

// ----------------------------------------------------------------------------
// 8. OVERVIEW + RESET + VERIFY PANEL
// ----------------------------------------------------------------------------

function overviewEmbed(cfg) {
    const lines = SECTIONS.map(s => {
        const v = cfg[s.key];
        const on = Array.isArray(v) ? v.length > 0 : v?.enabled;
        return `${s.emoji} **${s.label}** — ${on ? '🟢 on' : '⚪ off'}`;
    });
    return { embeds: [new EmbedBuilder().setColor(ACCENT).setTitle('🔎 Full Configuration Overview').setDescription(lines.join('\n')).setFooter({ text: BRAND })] };
}

function confirmReset(interaction) {
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('♻️ Reset all settings?')
        .setDescription('This wipes **every** setup category back to defaults for this server. This cannot be undone.');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:home:reset_yes').setLabel('Yes, reset everything').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup:home:reset_no').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    return interaction.update({ embeds: [embed], components: [row] });
}

async function postVerifyPanel(interaction, cfg) {
    const v = cfg.verification;
    if (!v.roleId) return safeReply(interaction, '❌ Set a verified role first.');
    const channel = v.channelId ? interaction.guild.channels.cache.get(v.channelId) : interaction.channel;
    if (!channel) return safeReply(interaction, '❌ Set a verify channel first.');
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('✅ Verification Required')
        .setDescription(`Welcome to **${interaction.guild.name}**! Click the button below to verify and unlock the server.`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_start').setLabel('Verify Me').setEmoji('✅').setStyle(ButtonStyle.Success),
    );
    await channel.send({ embeds: [embed], components: [row] });
    return safeReply(interaction, `📨 Posted the verification panel in ${channel}.`);
}

// ----------------------------------------------------------------------------
// 9. RUNTIME ENFORCEMENT (registered by init)
// ----------------------------------------------------------------------------

function fillPlaceholders(text, member, guild) {
    const g = guild || member.guild;
    return (text || '')
        .replace(/{user\.mention}/g, `<@${member.id}>`)
        .replace(/{user\.tag}/g, member.user.tag)
        .replace(/{user}/g, member.user.username)
        .replace(/{server}/g, g.name)
        .replace(/{memberCount}/g, g.memberCount);
}

async function sendWelcome(member, cfg, test = false) {
    const w = cfg.welcome;
    if (!test && !w.enabled) return;
    const guild = member.guild;
    if (w.channelId) {
        const ch = guild.channels.cache.get(w.channelId);
        if (ch) {
            const text = fillPlaceholders(w.message, member, guild);
            if (w.useEmbed) {
                const e = new EmbedBuilder().setColor(parseColor(w.color)).setDescription(text)
                    .setThumbnail(member.user.displayAvatarURL()).setFooter({ text: `Member #${guild.memberCount}` });
                if (w.imageUrl) e.setImage(w.imageUrl);
                await ch.send({ embeds: [e] }).catch(() => null);
            } else {
                await ch.send({ content: text, allowedMentions: { users: [member.id] } }).catch(() => null);
            }
        }
    }
    if (w.dm && !test) await member.send(fillPlaceholders(w.dmMessage, member, guild)).catch(() => null);
}

async function sendGoodbye(member, cfg, test = false) {
    const g = cfg.goodbye;
    if (!test && !g.enabled) return;
    if (!g.channelId) return;
    const ch = member.guild.channels.cache.get(g.channelId);
    if (!ch) return;
    const text = fillPlaceholders(g.message, member, member.guild);
    if (g.useEmbed) {
        const e = new EmbedBuilder().setColor(parseColor(g.color)).setDescription(text).setThumbnail(member.user.displayAvatarURL());
        await ch.send({ embeds: [e] }).catch(() => null);
    } else {
        await ch.send({ content: text, allowedMentions: { parse: [] } }).catch(() => null);
    }
}

const parseColor = hex => { const n = parseInt(String(hex).replace('#', ''), 16); return isNaN(n) ? ACCENT : n; };

async function applyAutorole(member, cfg) {
    const a = cfg.autorole;
    if (!a.enabled) return;
    const ids = member.user.bot ? a.botRoleIds : a.humanRoleIds;
    for (const id of ids) await member.roles.add(id).catch(() => null);
}

async function logEvent(guild, cfg, type, embed) {
    if (!cfg.logging.enabled) return;
    const id = cfg.logging[type];
    if (!id) return;
    const ch = guild.channels.cache.get(id);
    if (ch) await ch.send({ embeds: [embed] }).catch(() => null);
}

async function applyPresence(client, p) {
    const TYPE = { playing: 0, listening: 2, watching: 3, competing: 5 };
    try {
        client.user.setPresence({ status: p.status, activities: [{ name: p.text, type: TYPE[p.type] ?? 3 }] });
    } catch (e) { /* ignore */ }
}

async function refreshStats(guild, cfg) {
    const s = cfg.stats;
    if (!s.enabled) return;
    const members = guild.members.cache;
    const humans = members.filter(m => !m.user.bot).size || guild.memberCount;
    const bots = members.filter(m => m.user.bot).size;
    if (s.memberCountChannelId) {
        const ch = guild.channels.cache.get(s.memberCountChannelId);
        if (ch) await ch.setName(s.memberTemplate.replace('{count}', humans)).catch(() => null);
    }
    if (s.botCountChannelId) {
        const ch = guild.channels.cache.get(s.botCountChannelId);
        if (ch) await ch.setName(s.botTemplate.replace('{count}', bots)).catch(() => null);
    }
}

// In-memory state for spam/raid (per process).
const spamState = new Map();   // userId -> timestamps[]
const raidState = new Map();   // guildId -> timestamps[]
const pendingLog = new Map();  // guildId:userId -> which log channel is being set
const xpCooldown = new Map();  // guildId:userId -> last XP grant timestamp
const inviteCache = new Map(); // guildId -> Map(inviteCode -> uses)
const pendingRole = new Map(); // guildId:userId -> role chosen in the Mass Role panel

function init(client) {
    if (client._setupInit) return;
    client._setupInit = true;

    // Welcome / autorole / antiraid on join
    client.on(Events.GuildMemberAdd, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg) return;
        await sendWelcome(member, cfg).catch(() => null);
        await applyAutorole(member, cfg).catch(() => null);
        await logEvent(member.guild, cfg, 'memberLogId',
            new EmbedBuilder().setColor(0x22c55e).setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setDescription(`📥 ${member} joined.`).setTimestamp()).catch(() => null);

        if (cfg.antiraid.enabled) {
            const now = Date.now();
            const arr = (raidState.get(member.guild.id) || []).filter(t => now - t < cfg.antiraid.windowSeconds * 1000);
            arr.push(now); raidState.set(member.guild.id, arr);
            if (arr.length >= cfg.antiraid.joinThreshold) {
                if (cfg.antiraid.action === 'ban') await member.ban({ reason: 'Anti-raid' }).catch(() => null);
                else await member.kick('Anti-raid').catch(() => null);
                if (cfg.antiraid.alertChannelId) {
                    const ch = member.guild.channels.cache.get(cfg.antiraid.alertChannelId);
                    if (ch) await ch.send(`🚨 **Anti-raid triggered** — ${arr.length} joins in ${cfg.antiraid.windowSeconds}s. Acting (\`${cfg.antiraid.action}\`).`).catch(() => null);
                }
            }
        }
    });

    // Goodbye / member log on leave
    client.on(Events.GuildMemberRemove, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg) return;
        await sendGoodbye(member, cfg).catch(() => null);
        await logEvent(member.guild, cfg, 'memberLogId',
            new EmbedBuilder().setColor(0xef4444).setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setDescription(`📤 ${member.user.tag} left.`).setTimestamp()).catch(() => null);
    });

    // Message log: deletes & edits
    client.on(Events.MessageDelete, async message => {
        if (!message.guild || message.author?.bot) return;
        const cfg = await getConfig(message.guild.id).catch(() => null);
        if (!cfg) return;
        if (cfg.logging.ignoredChannelIds.includes(message.channelId)) return;
        await logEvent(message.guild, cfg, 'messageLogId',
            new EmbedBuilder().setColor(0xf59e0b).setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() })
                .setDescription(`🗑️ Message by ${message.author} deleted in ${message.channel}\n${(message.content || '*no text*').slice(0, 1000)}`).setTimestamp());
    });
    client.on(Events.MessageUpdate, async (oldM, newM) => {
        if (!newM.guild || newM.author?.bot || oldM.content === newM.content) return;
        const cfg = await getConfig(newM.guild.id).catch(() => null);
        if (!cfg) return;
        if (cfg.logging.ignoredChannelIds.includes(newM.channelId)) return;
        await logEvent(newM.guild, cfg, 'messageLogId',
            new EmbedBuilder().setColor(0x3b82f6).setAuthor({ name: newM.author.tag, iconURL: newM.author.displayAvatarURL() })
                .setDescription(`✏️ Message by ${newM.author} edited in ${newM.channel} — [jump](${newM.url})`)
                .addFields({ name: 'Before', value: (oldM.content || '*unknown*').slice(0, 500) }, { name: 'After', value: (newM.content || '*none*').slice(0, 500) }).setTimestamp());
    });

    // Mod log: bans / kicks (via audit-style events)
    client.on(Events.GuildBanAdd, async ban => {
        const cfg = await getConfig(ban.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(ban.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0xef4444).setDescription(`🔨 **${ban.user.tag}** was banned.`).setTimestamp());
    });
    client.on(Events.GuildBanRemove, async ban => {
        const cfg = await getConfig(ban.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(ban.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0x22c55e).setDescription(`♻️ **${ban.user.tag}** was unbanned.`).setTimestamp());
    });
    client.on(Events.ChannelCreate, async channel => {
        if (!channel.guild) return;
        const cfg = await getConfig(channel.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(channel.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0x22c55e).setDescription(`📺 Channel created: **#${channel.name}**`).setTimestamp());
    });
    client.on(Events.ChannelDelete, async channel => {
        if (!channel.guild) return;
        const cfg = await getConfig(channel.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(channel.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0xef4444).setDescription(`🗑️ Channel deleted: **#${channel.name}**`).setTimestamp());
    });
    client.on(Events.GuildRoleCreate, async role => {
        const cfg = await getConfig(role.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(role.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0x22c55e).setDescription(`🎭 Role created: ${role}`).setTimestamp());
    });
    client.on(Events.GuildRoleDelete, async role => {
        const cfg = await getConfig(role.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(role.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0xef4444).setDescription(`🎭 Role deleted: **${role.name}**`).setTimestamp());
    });
    client.on(Events.GuildEmojiCreate, async emoji => {
        const cfg = await getConfig(emoji.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(emoji.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0x22c55e).setDescription(`😀 Emoji added: ${emoji} \`:${emoji.name}:\``).setTimestamp());
    });
    client.on(Events.GuildEmojiDelete, async emoji => {
        const cfg = await getConfig(emoji.guild.id).catch(() => null);
        if (!cfg) return;
        await logEvent(emoji.guild, cfg, 'modLogId',
            new EmbedBuilder().setColor(0xef4444).setDescription(`😀 Emoji deleted: \`:${emoji.name}:\``).setTimestamp());
    });

    // Mod log: member timeouts (start & clear).
    client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
        const cfg = await getConfig(newM.guild.id).catch(() => null);
        if (!cfg?.logging.enabled || !cfg.logging.modLogId) return;
        const was = oldM.communicationDisabledUntilTimestamp || 0;
        const now = newM.communicationDisabledUntilTimestamp || 0;
        if (was === now) return;
        if (now > Date.now()) {
            await logEvent(newM.guild, cfg, 'modLogId', new EmbedBuilder().setColor(0xf59e0b)
                .setAuthor({ name: newM.user.tag, iconURL: newM.user.displayAvatarURL() })
                .setDescription(`🔇 ${newM} was timed out until <t:${Math.floor(now / 1000)}:F>`).setTimestamp());
        } else if (was > Date.now()) {
            await logEvent(newM.guild, cfg, 'modLogId', new EmbedBuilder().setColor(0x22c55e)
                .setAuthor({ name: newM.user.tag, iconURL: newM.user.displayAvatarURL() })
                .setDescription(`🔊 ${newM}'s timeout was lifted.`).setTimestamp());
        }
    });

    // Member log: nickname & role changes
    client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
        const cfg = await getConfig(newM.guild.id).catch(() => null);
        if (!cfg?.logging.enabled || !cfg.logging.memberLogId) return;
        if (oldM.nickname !== newM.nickname) {
            await logEvent(newM.guild, cfg, 'memberLogId', new EmbedBuilder().setColor(0x3b82f6)
                .setAuthor({ name: newM.user.tag, iconURL: newM.user.displayAvatarURL() })
                .setDescription(`✏️ Nickname changed: \`${oldM.nickname || oldM.user.username}\` → \`${newM.nickname || newM.user.username}\``).setTimestamp());
        }
        const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
        const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
        if (added.size || removed.size) {
            const parts = [];
            if (added.size) parts.push(`➕ ${added.map(r => r.toString()).join(' ')}`);
            if (removed.size) parts.push(`➖ ${removed.map(r => r.toString()).join(' ')}`);
            await logEvent(newM.guild, cfg, 'memberLogId', new EmbedBuilder().setColor(0x8b5cf6)
                .setAuthor({ name: newM.user.tag, iconURL: newM.user.displayAvatarURL() })
                .setDescription(`🎭 Roles updated for ${newM}\n${parts.join('\n')}`).setTimestamp());
        }
    });

    // Voice log
    client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
        const cfg = await getConfig((newS.guild || oldS.guild).id).catch(() => null);
        if (!cfg || !cfg.logging.enabled || !cfg.logging.voiceLogId) return;
        let desc = null;
        if (!oldS.channel && newS.channel) desc = `🔊 ${newS.member} joined **${newS.channel.name}**`;
        else if (oldS.channel && !newS.channel) desc = `🔇 ${oldS.member} left **${oldS.channel.name}**`;
        else if (oldS.channelId !== newS.channelId) desc = `🔀 ${newS.member} moved **${oldS.channel.name} → ${newS.channel.name}**`;
        if (desc) await logEvent(newS.guild, cfg, 'voiceLogId', new EmbedBuilder().setColor(0x8b5cf6).setDescription(desc).setTimestamp());
    });

    // Messages: filter, antispam, autoresponders
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot || message.webhookId) return;
        const cfg = await getConfig(message.guild.id).catch(() => null);
        if (!cfg) return;

        // Word filter
        if (cfg.filter.enabled && cfg.filter.words.length) {
            const member = message.member;
            const bypass = member && cfg.filter.whitelistRoleIds.some(r => member.roles.cache.has(r));
            if (!bypass) {
                const lower = message.content.toLowerCase();
                const hit = cfg.filter.words.find(w => lower.includes(w));
                if (hit) {
                    await message.delete().catch(() => null);
                    if (cfg.filter.action === 'timeout' && member?.moderatable) {
                        await member.timeout(cfg.filter.timeoutMinutes * 60000, `Word filter: ${hit}`).catch(() => null);
                    }
                    if (cfg.filter.action !== 'delete') {
                        await message.channel.send({ content: `${message.author}, watch your language.`, allowedMentions: { users: [message.author.id] } })
                            .then(m => setTimeout(() => m.delete().catch(() => null), 4000)).catch(() => null);
                    }
                    if (cfg.filter.logChannelId) {
                        const ch = message.guild.channels.cache.get(cfg.filter.logChannelId);
                        if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setDescription(`🧹 Filtered a message from ${message.author} in ${message.channel} (matched \`${hit}\`).`).setTimestamp()] }).catch(() => null);
                    }
                    return;
                }
            }
        }

        // Anti-spam
        if (cfg.antispam.enabled) {
            const now = Date.now();
            const key = `${message.guild.id}:${message.author.id}`;
            const arr = (spamState.get(key) || []).filter(t => now - t < cfg.antispam.intervalSeconds * 1000);
            arr.push(now); spamState.set(key, arr);
            if (arr.length > cfg.antispam.maxMessages) {
                if (cfg.antispam.action === 'timeout' && message.member?.moderatable) {
                    await message.member.timeout(cfg.antispam.timeoutSeconds * 1000, 'Anti-spam').catch(() => null);
                }
                await message.channel.bulkDelete(Math.min(arr.length, 10)).catch(() => null);
                spamState.set(key, []);
                return;
            }
        }

        // Autoresponders
        for (const ar of cfg.autoresponders) {
            const content = message.content.toLowerCase();
            const trig = ar.trigger.toLowerCase();
            const ok = ar.match === 'exact' ? content === trig : ar.match === 'startswith' ? content.startsWith(trig) : content.includes(trig);
            if (ok) { await message.reply({ content: ar.response.slice(0, 2000), allowedMentions: { repliedUser: false } }).catch(() => null); break; }
        }
    });

    // Reaction roles + starboard
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => null);
        const guild = reaction.message.guild;
        if (!guild) return;
        const cfg = await getConfig(guild.id).catch(() => null);
        if (!cfg) return;

        // Reaction roles
        for (const rr of cfg.reactionRoles) {
            if (rr.messageId !== reaction.message.id) continue;
            const pair = rr.pairs.find(p => p.emoji === reaction.emoji.toString() || p.emoji === reaction.emoji.name);
            if (pair) { const m = await guild.members.fetch(user.id).catch(() => null); if (m) await m.roles.add(pair.roleId).catch(() => null); }
        }

        // Starboard
        if (cfg.starboard.enabled && cfg.starboard.channelId) {
            const emojiKey = reaction.emoji.toString();
            if (emojiKey === cfg.starboard.emoji || reaction.emoji.name === cfg.starboard.emoji) {
                if (reaction.count >= cfg.starboard.threshold) await postStarboard(reaction, cfg).catch(() => null);
            }
        }
    });

    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => null);
        const guild = reaction.message.guild;
        if (!guild) return;
        const cfg = await getConfig(guild.id).catch(() => null);
        if (!cfg) return;
        for (const rr of cfg.reactionRoles) {
            if (rr.messageId !== reaction.message.id) continue;
            const pair = rr.pairs.find(p => p.emoji === reaction.emoji.toString() || p.emoji === reaction.emoji.name);
            if (pair) { const m = await guild.members.fetch(user.id).catch(() => null); if (m) await m.roles.remove(pair.roleId).catch(() => null); }
        }
    });

    // Join gate + dehoist on join (separate listener from the welcome one above).
    client.on(Events.GuildMemberAdd, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg) return;

        if (cfg.joingate.enabled) {
            const ageDays = (Date.now() - member.user.createdTimestamp) / 86400000;
            if (ageDays < cfg.joingate.minAccountAgeDays) {
                if (cfg.joingate.alertChannelId) {
                    const ch = member.guild.channels.cache.get(cfg.joingate.alertChannelId);
                    if (ch) await ch.send(`⛔ Join gate: ${member.user.tag} (account ${ageDays.toFixed(1)}d old) — \`${cfg.joingate.action}\`.`).catch(() => null);
                }
                if (cfg.joingate.action === 'ban') await member.ban({ reason: 'Join gate: account too new' }).catch(() => null);
                else await member.kick('Join gate: account too new').catch(() => null);
                return;
            }
        }
        if (cfg.modtools.dehoist) await dehoist(member).catch(() => null);
    });

    // Main message-driven systems: leveling, economy, link filter, auto-publish,
    // sticky, suggestions, auto-react and mention limits.
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot || message.webhookId) return;
        const cfg = await getConfig(message.guild.id).catch(() => null);
        if (!cfg) return;
        const member = message.member;
        let dirty = false;

        // Mention limit (mod tools)
        if (cfg.modtools.maxMentions > 0 && !member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const total = message.mentions.users.size + message.mentions.roles.size;
            if (total > cfg.modtools.maxMentions) {
                await message.delete().catch(() => null);
                if (cfg.modtools.maxMentionsAction === 'timeout' && member?.moderatable) await member.timeout(60000, 'Mass mention').catch(() => null);
                return;
            }
        }

        // Link filter
        if (cfg.linkfilter.enabled) {
            const wlRole = member && cfg.linkfilter.whitelistRoleIds.some(r => member.roles.cache.has(r));
            const wlChan = cfg.linkfilter.whitelistChannelIds.includes(message.channel.id);
            if (!wlRole && !wlChan) {
                const hasInvite = /discord(?:\.gg|(?:app)?\.com\/invite)\/[\w-]+/i.test(message.content);
                const hasLink = /https?:\/\/\S+/i.test(message.content);
                if ((cfg.linkfilter.blockInvites && hasInvite) || (cfg.linkfilter.blockLinks && hasLink)) {
                    await message.delete().catch(() => null);
                    if (cfg.linkfilter.action === 'warn') {
                        await message.channel.send({ content: `${message.author}, links/invites aren't allowed here.`, allowedMentions: { users: [message.author.id] } })
                            .then(m => setTimeout(() => m.delete().catch(() => null), 4000)).catch(() => null);
                    }
                    return;
                }
            }
        }

        // Auto-publish announcement channels
        if (cfg.autopublish.enabled && cfg.autopublish.channelIds.includes(message.channel.id) && message.channel.type === ChannelType.GuildAnnouncement) {
            await message.crosspost().catch(() => null);
        }

        // Suggestions board
        if (cfg.suggestions.enabled && message.channel.id === cfg.suggestions.channelId && message.content.trim()) {
            await postSuggestion(message, cfg).catch(() => null);
            return;
        }

        // Auto-react
        if (cfg.autoreact.enabled) {
            const rule = cfg.autoreact.rules.find(r => r.channelId === message.channel.id);
            if (rule) for (const e of rule.emojis) await message.react(e).catch(() => null);
        }

        // Sticky messages
        for (const st of cfg.sticky.messages) {
            if (st.channelId !== message.channel.id) continue;
            st.counter = (st.counter || 0) + 1;
            if (st.counter >= st.every) {
                st.counter = 0;
                if (st.lastMessageId) await message.channel.messages.delete(st.lastMessageId).catch(() => null);
                const sent = await message.channel.send({ embeds: [new EmbedBuilder().setColor(ACCENT).setDescription(st.content)] }).catch(() => null);
                if (sent) st.lastMessageId = sent.id;
            }
            dirty = true;
        }

        // Leveling
        if (cfg.leveling.enabled && !cfg.leveling.ignoredChannelIds.includes(message.channel.id)) {
            const key = `${message.guild.id}:${message.author.id}`;
            const now = Date.now();
            if (now - (xpCooldown.get(key) || 0) >= cfg.leveling.cooldownSeconds * 1000) {
                xpCooldown.set(key, now);
                const u = levelUser(cfg, message.author.id);
                u.xp += Math.round(cfg.leveling.xpPerMessage * cfg.leveling.multiplier);
                let leveled = false;
                while (u.xp >= xpForLevel(u.level)) { u.xp -= xpForLevel(u.level); u.level++; leveled = true; }
                if (leveled) await announceLevel(message, cfg, u).catch(() => null);
                dirty = true;
            }
        }

        // Economy chat earnings
        if (cfg.economy.enabled && cfg.economy.chatEarn > 0) {
            const key = `${message.guild.id}:eco:${message.author.id}`;
            const now = Date.now();
            if (now - (xpCooldown.get(key) || 0) >= 60000) { // once a minute, like XP
                xpCooldown.set(key, now);
                ecoAccount(cfg, message.author.id).balance += cfg.economy.chatEarn;
                dirty = true;
            }
        }

        if (dirty) { cfg.markModified('leveling'); cfg.markModified('economy'); cfg.markModified('sticky'); await cfg.save().catch(() => null); }
    });

    // Auto-thread, media-only and announce-ping (independent listener).
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot || message.system) return;
        const cfg = await getConfig(message.guild.id).catch(() => null);
        if (!cfg) return;

        // Media-only enforcement
        if (cfg.mediaonly.enabled && cfg.mediaonly.channelIds.includes(message.channel.id)) {
            const hasMedia = message.attachments.size > 0 || message.embeds.some(e => e.image || e.video);
            const hasLink = /https?:\/\/\S+/i.test(message.content);
            if (!hasMedia && !(cfg.mediaonly.allowLinks && hasLink)) {
                await message.delete().catch(() => null);
                await message.channel.send({ content: `${message.author}, this channel is media-only.`, allowedMentions: { users: [message.author.id] } })
                    .then(m => setTimeout(() => m.delete().catch(() => null), 4000)).catch(() => null);
                return;
            }
        }

        // Auto-thread
        if (cfg.autothread.enabled) {
            const rule = cfg.autothread.rules.find(r => r.channelId === message.channel.id);
            if (rule && message.channel.threads) {
                await message.startThread({ name: (rule.nameTemplate || '{user}').replace('{user}', message.member?.displayName || message.author.username).slice(0, 90) }).catch(() => null);
            }
        }

        // Announce ping
        if (cfg.announceping.enabled) {
            const map = cfg.announceping.mappings.find(m => m.channelId === message.channel.id);
            if (map) await message.channel.send({ content: `<@&${map.roleId}>`, allowedMentions: { roles: [map.roleId] } }).catch(() => null);
        }
    });

    // Counting game (its own listener so other systems' early-returns don't skip it).
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot) return;
        const cfg = await getConfig(message.guild.id).catch(() => null);
        if (!cfg?.counting.enabled || message.channel.id !== cfg.counting.channelId) return;
        const c = cfg.counting;
        const num = parseInt(message.content.trim(), 10);
        const expected = c.current + 1;
        if (isNaN(num)) return; // non-numbers are ignored, not penalised
        if (num !== expected || message.author.id === c.lastUserId) {
            await message.react('❌').catch(() => null);
            if (c.resetOnFail) {
                await message.channel.send(`💥 ${message.author} broke the chain at **${c.current}**! Back to **1**.`).catch(() => null);
                c.current = 0; c.lastUserId = null;
            } else {
                await message.delete().catch(() => null);
            }
        } else {
            c.current = expected; c.lastUserId = message.author.id;
            if (c.current > c.highScore) c.highScore = c.current;
            await message.react('✅').catch(() => null);
        }
        cfg.markModified('counting'); await cfg.save().catch(() => null);
    });

    // Boost announcements.
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        if (oldMember.premiumSince || !newMember.premiumSince) return; // only on a new boost
        const cfg = await getConfig(newMember.guild.id).catch(() => null);
        if (!cfg?.boost.enabled || !cfg.boost.channelId) return;
        const ch = newMember.guild.channels.cache.get(cfg.boost.channelId);
        if (!ch) return;
        const text = (cfg.boost.message || '').replace(/{user\.mention}/g, `<@${newMember.id}>`).replace(/{server}/g, newMember.guild.name);
        await ch.send({ content: text, allowedMentions: { users: [newMember.id] } }).catch(() => null);
    });

    // Sticky roles: remember on leave, restore on rejoin.
    client.on(Events.GuildMemberRemove, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg?.stickyroles.enabled) return;
        const roleIds = member.roles.cache.filter(r => r.id !== member.guild.id && !r.managed).map(r => r.id);
        cfg.stickyroles.store = cfg.stickyroles.store.filter(s => s.userId !== member.id);
        if (roleIds.length) cfg.stickyroles.store.push({ userId: member.id, roleIds });
        cfg.markModified('stickyroles'); await cfg.save().catch(() => null);
    });
    client.on(Events.GuildMemberAdd, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg?.stickyroles.enabled) return;
        const saved = cfg.stickyroles.store.find(s => s.userId === member.id);
        if (!saved) return;
        for (const id of saved.roleIds) await member.roles.add(id).catch(() => null);
        cfg.stickyroles.store = cfg.stickyroles.store.filter(s => s.userId !== member.id);
        cfg.markModified('stickyroles'); await cfg.save().catch(() => null);
    });

    // Temp voice: create on hub join, delete when empty.
    client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
        const guild = newS.guild || oldS.guild;
        const cfg = await getConfig(guild.id).catch(() => null);
        if (!cfg?.tempvoice.enabled) return;
        const t = cfg.tempvoice;

        // Joined the hub → spin up a personal channel.
        if (newS.channelId && newS.channelId === t.hubChannelId) {
            const parent = t.categoryId ? guild.channels.cache.get(t.categoryId) : newS.channel?.parent;
            const ch = await guild.channels.create({
                name: t.nameTemplate.replace('{user}', newS.member.displayName).slice(0, 90),
                type: ChannelType.GuildVoice,
                parent: parent?.id,
            }).catch(() => null);
            if (ch) {
                t.active.push(ch.id);
                await newS.member.voice.setChannel(ch).catch(() => null);
                cfg.markModified('tempvoice'); await cfg.save().catch(() => null);
            }
        }

        // Left a temp channel that is now empty → tear it down.
        if (oldS.channelId && t.active.includes(oldS.channelId)) {
            const ch = guild.channels.cache.get(oldS.channelId);
            if (ch && ch.members.size === 0) {
                await ch.delete().catch(() => null);
                t.active = t.active.filter(id => id !== oldS.channelId);
                cfg.markModified('tempvoice'); await cfg.save().catch(() => null);
            }
        }
    });

    // Scheduled messages — checked every minute.
    setInterval(async () => {
        const now = Date.now();
        for (const guild of client.guilds.cache.values()) {
            const cfg = await getConfig(guild.id).catch(() => null);
            if (!cfg?.scheduled.messages.length) continue;
            let dirty = false;
            for (const sm of cfg.scheduled.messages) {
                if (now - (sm.lastRun || 0) < sm.intervalMinutes * 60000) continue;
                const ch = guild.channels.cache.get(sm.channelId);
                if (ch) await ch.send(sm.embed ? { embeds: [new EmbedBuilder().setColor(ACCENT).setDescription(sm.content)] } : { content: sm.content.slice(0, 2000) }).catch(() => null);
                sm.lastRun = now; dirty = true;
            }
            if (dirty) { cfg.markModified('scheduled'); await cfg.save().catch(() => null); }
        }
    }, 60 * 1000);

    // Voice XP — grant leveling XP per minute spent in a voice channel.
    setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            const cfg = await getConfig(guild.id).catch(() => null);
            if (!cfg?.leveling.enabled || !cfg.leveling.voiceXpPerMin) continue;
            let dirty = false;
            for (const ch of guild.channels.cache.values()) {
                if (ch.type !== ChannelType.GuildVoice) continue;
                for (const m of ch.members.values()) {
                    if (m.user.bot || m.voice.deaf || ch.id === guild.afkChannelId) continue;
                    const u = levelUser(cfg, m.id);
                    u.xp += Math.round(cfg.leveling.voiceXpPerMin * cfg.leveling.multiplier);
                    while (u.xp >= xpForLevel(u.level)) {
                        u.xp -= xpForLevel(u.level); u.level++;
                        const reward = cfg.leveling.rewards.find(r => r.level === u.level);
                        if (reward) await m.roles.add(reward.roleId).catch(() => null);
                    }
                    dirty = true;
                }
            }
            if (dirty) { cfg.markModified('leveling'); await cfg.save().catch(() => null); }
        }
    }, 60 * 1000);

    // Auto-purge tasks — checked every 5 minutes.
    setInterval(async () => {
        const now = Date.now();
        for (const guild of client.guilds.cache.values()) {
            const cfg = await getConfig(guild.id).catch(() => null);
            if (!cfg?.autopurge.tasks.length) continue;
            let dirty = false;
            for (const task of cfg.autopurge.tasks) {
                if (now - (task.lastRun || 0) < task.everyHours * 3600000) continue;
                const ch = guild.channels.cache.get(task.channelId);
                if (ch?.messages) {
                    const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
                    if (msgs) {
                        const del = msgs.filter(m => (!task.keepPinned || !m.pinned) && (Date.now() - m.createdTimestamp) < 14 * 86400000);
                        if (del.size) await ch.bulkDelete(del, true).catch(() => null);
                    }
                }
                task.lastRun = now; dirty = true;
            }
            if (dirty) { cfg.markModified('autopurge'); await cfg.save().catch(() => null); }
        }
    }, 5 * 60 * 1000);

    // Nickname filter — on join and on nickname change.
    const checkNick = async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg?.nickfilter.enabled || !cfg.nickfilter.words.length) return;
        const name = (member.displayName || '').toLowerCase();
        if (!cfg.nickfilter.words.some(w => name.includes(w))) return;
        if (cfg.nickfilter.action === 'kick') await member.kick('Nickname filter').catch(() => null);
        else await member.setNickname(member.user.username).catch(() => null);
    };
    client.on(Events.GuildMemberAdd, checkNick);
    client.on(Events.GuildMemberUpdate, (oldM, newM) => {
        if (oldM.nickname !== newM.nickname || oldM.user.username !== newM.user.username) checkNick(newM).catch(() => null);
    });

    // Invite tracker — cache invite uses and detect which one each joiner used.
    const cacheInvites = async guild => {
        try { const invs = await guild.invites.fetch(); inviteCache.set(guild.id, new Map(invs.map(i => [i.code, i.uses || 0]))); } catch { /* missing Manage Server */ }
    };
    client.on(Events.InviteCreate, inv => { const m = inviteCache.get(inv.guild.id) || new Map(); m.set(inv.code, inv.uses || 0); inviteCache.set(inv.guild.id, m); });
    client.on(Events.InviteDelete, inv => { inviteCache.get(inv.guild.id)?.delete(inv.code); });
    client.on(Events.GuildMemberAdd, async member => {
        const cfg = await getConfig(member.guild.id).catch(() => null);
        if (!cfg?.invites.enabled) return;
        const before = inviteCache.get(member.guild.id) || new Map();
        let after;
        try { after = await member.guild.invites.fetch(); } catch { return; }
        inviteCache.set(member.guild.id, new Map(after.map(i => [i.code, i.uses || 0])));
        const used = after.find(i => (i.uses || 0) > (before.get(i.code) || 0));
        const inviter = used?.inviter;
        if (inviter && !inviter.bot) {
            let c = cfg.invites.counts.find(x => x.userId === inviter.id);
            if (!c) { c = { userId: inviter.id, count: 0 }; cfg.invites.counts.push(c); }
            c.count++;
            cfg.markModified('invites'); await cfg.save().catch(() => null);
        }
        if (cfg.invites.channelId) {
            const ch = member.guild.channels.cache.get(cfg.invites.channelId);
            if (ch) await ch.send(`📨 ${member} joined — invited by ${inviter ? `**${inviter.tag}**` : 'an unknown source'}.`).catch(() => null);
        }
    });
    setTimeout(() => { for (const g of client.guilds.cache.values()) cacheInvites(g); }, 5000);

    // Birthday checker — runs hourly, announces once per day.
    setInterval(() => runBirthdays(client).catch(() => null), 60 * 60 * 1000);
    setTimeout(() => runBirthdays(client).catch(() => null), 15000); // also shortly after boot

    // Periodically refresh stat counters (every 10 minutes).
    setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            const cfg = await getConfig(guild.id).catch(() => null);
            if (cfg?.stats.enabled) await refreshStats(guild, cfg).catch(() => null);
        }
    }, 10 * 60 * 1000);

    console.log('[setup] runtime enforcement initialised.');
}

// --- Runtime helpers for the extended systems ------------------------------

async function dehoist(member) {
    const name = member.displayName;
    if (/^[^a-z0-9]/i.test(name)) {
        const cleaned = name.replace(/^[^a-z0-9]+/i, '').trim() || 'member';
        await member.setNickname(cleaned).catch(() => null);
    }
}

async function announceLevel(message, cfg, user) {
    const text = (cfg.leveling.announceMessage || '')
        .replace(/{user\.mention}/g, `<@${user.userId}>`)
        .replace(/{user}/g, message.author.username)
        .replace(/{level}/g, user.level);
    const target = cfg.leveling.announceChannelId
        ? message.guild.channels.cache.get(cfg.leveling.announceChannelId)
        : message.channel;
    if (target) await target.send({ content: text, allowedMentions: { users: [user.userId] } }).catch(() => null);

    // Role rewards for this level.
    const reward = cfg.leveling.rewards.find(r => r.level === user.level);
    if (reward) {
        const m = await message.guild.members.fetch(user.userId).catch(() => null);
        if (m) {
            await m.roles.add(reward.roleId).catch(() => null);
            if (!cfg.leveling.stack) {
                for (const r of cfg.leveling.rewards) if (r.level < user.level && r.roleId !== reward.roleId) await m.roles.remove(r.roleId).catch(() => null);
            }
        }
    }
}

async function postSuggestion(message, cfg) {
    const s = cfg.suggestions;
    const ch = message.channel;
    const embed = new EmbedBuilder().setColor(ACCENT).setDescription(message.content.slice(0, 2000)).setTimestamp();
    if (!s.anonymous) embed.setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() });
    else embed.setAuthor({ name: 'Anonymous suggestion' });
    const img = message.attachments.find(a => a.contentType?.startsWith('image'));
    if (img) embed.setImage(img.url);
    await message.delete().catch(() => null);
    const sent = await ch.send({ embeds: [embed] }).catch(() => null);
    if (!sent) return;
    await sent.react(s.upvote).catch(() => null);
    await sent.react(s.downvote).catch(() => null);
    if (s.autoThread) await sent.startThread({ name: `Suggestion by ${message.author.username}`.slice(0, 90) }).catch(() => null);
}

async function runBirthdays(client) {
    const now = new Date();
    const today = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    const month = now.getUTCMonth() + 1, day = now.getUTCDate();
    for (const guild of client.guilds.cache.values()) {
        const cfg = await getConfig(guild.id).catch(() => null);
        if (!cfg?.birthdays.enabled) continue;
        const b = cfg.birthdays;
        const todays = b.entries.filter(e => e.month === month && e.day === day);

        // Maintain the birthday role (add for today, strip from everyone else).
        if (b.roleId) {
            const role = guild.roles.cache.get(b.roleId);
            if (role) {
                for (const m of role.members.values()) if (!todays.some(e => e.userId === m.id)) await m.roles.remove(b.roleId).catch(() => null);
                for (const e of todays) { const m = await guild.members.fetch(e.userId).catch(() => null); if (m) await m.roles.add(b.roleId).catch(() => null); }
            }
        }
        if (b.lastRun === today) continue; // already announced today
        if (todays.length && b.channelId) {
            const ch = guild.channels.cache.get(b.channelId);
            if (ch) for (const e of todays) {
                await ch.send({ content: (b.message || '').replace(/{user\.mention}/g, `<@${e.userId}>`), allowedMentions: { users: [e.userId] } }).catch(() => null);
            }
        }
        b.lastRun = today;
        cfg.markModified('birthdays'); await cfg.save().catch(() => null);
    }
}

// Public (non-admin) components: self-role buttons + birthday registration.
async function handlePublic(interaction) {
    if (!interaction.inGuild()) return;
    const [, kind, arg] = interaction.customId.split(':');
    try {
        if (interaction.isButton() && kind === 'selfrole') {
            const roleId = arg;
            const member = interaction.member;
            const has = member.roles.cache.has(roleId);
            if (has) await member.roles.remove(roleId).catch(() => null);
            else await member.roles.add(roleId).catch(() => null);
            return interaction.reply({ content: has ? `➖ Removed <@&${roleId}>.` : `➕ Added <@&${roleId}>.`, ...ephemeral });
        }
        if (interaction.isAnySelectMenu() && kind === 'droles') {
            const cfg = await getConfig(interaction.guildId);
            const menu = cfg.dropdownroles.menus[Number(arg)];
            if (!menu) return interaction.reply({ content: '❌ This menu no longer exists.', ...ephemeral });
            const member = interaction.member;
            const selected = new Set(interaction.values);
            const added = [], removed = [];
            for (const r of menu.roles) {
                if (selected.has(r.roleId)) { if (!member.roles.cache.has(r.roleId)) { await member.roles.add(r.roleId).catch(() => null); added.push(r.roleId); } }
                else if (member.roles.cache.has(r.roleId)) { await member.roles.remove(r.roleId).catch(() => null); removed.push(r.roleId); }
            }
            const parts = [];
            if (added.length) parts.push(`➕ ${added.map(id => `<@&${id}>`).join(' ')}`);
            if (removed.length) parts.push(`➖ ${removed.map(id => `<@&${id}>`).join(' ')}`);
            return interaction.reply({ content: parts.join('\n') || 'No changes.', ...ephemeral });
        }
        if (interaction.isButton() && kind === 'eco') {
            const cfg = await getConfig(interaction.guildId);
            const e = cfg.economy;
            if (!e.enabled) return interaction.reply({ content: '❌ The economy is disabled.', ...ephemeral });
            const acc = ecoAccount(cfg, interaction.user.id);
            const now = Date.now();
            if (arg === 'daily') {
                if (now - (acc.lastDaily || 0) < 86400000) {
                    const left = Math.ceil((86400000 - (now - acc.lastDaily)) / 3600000);
                    return interaction.reply({ content: `⏳ You already claimed your daily. Come back in ~${left}h.`, ...ephemeral });
                }
                acc.lastDaily = now; acc.balance += e.dailyAmount;
                cfg.markModified('economy'); await cfg.save();
                return interaction.reply({ content: `📅 Claimed ${e.symbol} **${e.dailyAmount}**! Balance: **${acc.balance}**.`, ...ephemeral });
            }
            if (arg === 'work') {
                if (now - (acc.lastWork || 0) < 3600000) {
                    const left = Math.ceil((3600000 - (now - acc.lastWork)) / 60000);
                    return interaction.reply({ content: `⏳ You're tired. Work again in ~${left}m.`, ...ephemeral });
                }
                const earned = e.workMin + Math.floor(Math.random() * (e.workMax - e.workMin + 1));
                acc.lastWork = now; acc.balance += earned;
                cfg.markModified('economy'); await cfg.save();
                return interaction.reply({ content: `💼 You worked and earned ${e.symbol} **${earned}**! Balance: **${acc.balance}**.`, ...ephemeral });
            }
            if (arg === 'balance') {
                const rank = [...e.accounts].sort((a, b) => b.balance - a.balance).findIndex(a => a.userId === interaction.user.id) + 1;
                return interaction.reply({ content: `💰 You have ${e.symbol} **${acc.balance}** — rank **#${rank}** of ${e.accounts.length}.`, ...ephemeral });
            }
            if (arg === 'top') {
                const top = [...e.accounts].sort((a, b) => b.balance - a.balance).slice(0, 10).map((a, i) => `**${i + 1}.** <@${a.userId}> — ${e.symbol} ${a.balance}`).join('\n') || '*nobody yet*';
                return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🏆 Richest Members').setDescription(top)], ...ephemeral });
            }
        }
        if (interaction.isAnySelectMenu() && kind === 'shop') {
            const cfg = await getConfig(interaction.guildId);
            const item = cfg.shop.items[Number(interaction.values[0])];
            if (!cfg.shop.enabled || !item) return interaction.reply({ content: '❌ This item is unavailable.', ...ephemeral });
            if (interaction.member.roles.cache.has(item.roleId)) return interaction.reply({ content: '❌ You already own that role.', ...ephemeral });
            const acc = ecoAccount(cfg, interaction.user.id);
            if (acc.balance < item.price) return interaction.reply({ content: `❌ You need ${cfg.economy.symbol} **${item.price}** but only have **${acc.balance}**.`, ...ephemeral });
            acc.balance -= item.price;
            cfg.markModified('economy'); await cfg.save();
            await interaction.member.roles.add(item.roleId).catch(() => null);
            return interaction.reply({ content: `✅ Bought **${item.name}** for ${cfg.economy.symbol} ${item.price}. Balance: **${acc.balance}**.`, ...ephemeral });
        }
        if (interaction.isButton() && kind === 'bday' && arg === 'open') {
            const modal = new ModalBuilder().setCustomId('setpub:bday:save').setTitle('Set Your Birthday');
            modal.addComponents(
                new ActionRowBuilder().addComponents(modalInput('month', 'Month (1-12)', TextInputStyle.Short, '', true)),
                new ActionRowBuilder().addComponents(modalInput('day', 'Day (1-31)', TextInputStyle.Short, '', true)),
            );
            return interaction.showModal(modal);
        }
        if (interaction.isModalSubmit() && kind === 'bday' && arg === 'save') {
            const month = clampInt(field(interaction, 'month'), 0, 1, 12);
            const day = clampInt(field(interaction, 'day'), 0, 1, 31);
            if (!month || !day) return interaction.reply({ content: '❌ Enter a valid month and day.', ...ephemeral });
            const cfg = await getConfig(interaction.guildId);
            cfg.birthdays.entries = cfg.birthdays.entries.filter(e => e.userId !== interaction.user.id);
            cfg.birthdays.entries.push({ userId: interaction.user.id, month, day });
            cfg.markModified('birthdays'); await cfg.save();
            return interaction.reply({ content: `🎂 Saved your birthday as **${month}/${day}**.`, ...ephemeral });
        }
    } catch (err) {
        console.error('[setup public] error:', err);
        return safeReply(interaction, '❌ Something went wrong.');
    }
}

const starboardPosted = new Set();
async function postStarboard(reaction, cfg) {
    const key = `${reaction.message.guild.id}:${reaction.message.id}`;
    if (starboardPosted.has(key)) return;
    starboardPosted.add(key);
    const ch = reaction.message.guild.channels.cache.get(cfg.starboard.channelId);
    if (!ch) return;
    const msg = reaction.message;
    const embed = new EmbedBuilder().setColor(0xf59e0b)
        .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
        .setDescription(msg.content || '*[no text]*')
        .addFields({ name: 'Jump', value: `[Go to message](${msg.url})` })
        .setFooter({ text: `${cfg.starboard.emoji} ${reaction.count}` }).setTimestamp();
    const img = msg.attachments.find(a => a.contentType?.startsWith('image'));
    if (img) embed.setImage(img.url);
    await ch.send({ embeds: [embed] }).catch(() => null);
}

// ----------------------------------------------------------------------------
// 10. SLASH COMMAND
// ----------------------------------------------------------------------------

module.exports = {
    init,
    handleInteraction,
    handlePublic,
    getConfig,

    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Open the all-in-one server setup control panel')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const cfg = await getConfig(interaction.guildId);
        return interaction.reply({ ...homePanel(cfg), ...ephemeral });
    },
};

// Dev self-test: `node setup.js` renders every panel and validates that all
// components serialise (catches builder mistakes — too many rows, empty menus,
// over-long labels). Never runs in production.
if (require.main === module) {
    const cfg = new SetupConfig({ guildId: '1' });
    cfg.reactionRoles.push({ messageId: '111', channelId: '222', pairs: [{ emoji: '⭐', roleId: '333' }] });
    cfg.autoresponders.push({ trigger: 'hi', response: 'hello', match: 'contains' });
    cfg.selfroles.menus.push({ title: 'Test', channelId: '1', messageId: '2', roles: [{ roleId: '9', label: 'A', emoji: '', style: 'Secondary' }] });
    cfg.sticky.messages.push({ channelId: '1', content: 'hi', every: 5, counter: 0, lastMessageId: null });
    cfg.autoreact.rules.push({ channelId: '1', emojis: ['👍'] });
    cfg.leveling.rewards.push({ level: 5, roleId: '7' });
    cfg.leveling.users.push({ userId: 'u', xp: 10, level: 1 });
    cfg.economy.accounts.push({ userId: 'u', balance: 50, lastDaily: 0, lastWork: 0 });
    cfg.dropdownroles.menus.push({ title: 'D', placeholder: 'pick', min: 0, max: 1, channelId: '1', messageId: '2', roles: [{ roleId: '9', label: 'A', emoji: '', description: '' }] });
    cfg.scheduled.messages.push({ channelId: '1', content: 'hi', intervalMinutes: 60, lastRun: 0, embed: false });
    let panels = 0;
    const check = (name, payload) => {
        if (payload.components.length > 5) throw new Error(`${name}: ${payload.components.length} rows (>5)`);
        payload.components.forEach(r => r.toJSON());
        payload.embeds.forEach(e => e.toJSON());
        panels++;
    };
    check('home', homePanel(cfg));
    for (const s of SECTIONS) check(s.key, renderSection(s.key, cfg));
    check('selfroleMenu', PANELS._selfroleMenu(cfg, 0));
    check('selfRoleMessage', selfRoleMessage(cfg.selfroles.menus[0]));
    check('dropdownMenu', PANELS._dropdownMenu(cfg, 0));
    check('dropdownRoleMessage', dropdownRoleMessage(cfg.dropdownroles.menus[0], 0));
    check('overview', { components: [], embeds: overviewEmbed(cfg).embeds });
    console.log(`✅ setup self-test passed — ${panels} panels render valid components.`);
}

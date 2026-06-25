const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

// 👉 Set this to the role members receive once verified.
const VERIFIED_ROLE_ID = '1517292536727736410';

const WORD_BANK = [
    // 🚗 Objects & Things
    'rocket', 'anchor', 'camera', 'guitar', 'helmet', 'jacket', 'magnet', 'napkin', 'pocket', 'pencil',
    'puzzle', 'bucket', 'candle', 'coupon', 'hammer', 'island', 'laptop', 'mirror', 'pillow', 'wallet',

    // 🦁 Animals & Nature
    'turtle', 'monkey', 'rabbit', 'dolphin', 'falcon', 'lizard', 'kitten', 'badger', 'cactus', 'forest',
    'canyon', 'valley', 'stream', 'pebble', 'clover', 'beetle', 'spider', 'walrus', 'penguin', 'jaguar',

    // 🎨 Colors & Descriptions
    'purple', 'orange', 'silver', 'bronze', 'yellow', 'bright', 'silent', 'clever', 'prompt', 'hidden',
    'frozen', 'golden', 'smooth', 'hollow', 'cosmic', 'gentle', 'shadow', 'liquid', 'modern', 'random',

    // 🍔 Food & Places
    'cookie', 'muffin', 'waffle', 'banana', 'cherry', 'cheese', 'burger', 'market', 'castle', 'garage',
    'palace', 'garden', 'tunnel', 'bakery', 'office', 'studio', 'arcade', 'cinema', 'museum', 'planet',

    // 🏃 Actions & Abstract
    'journey', 'venture', 'glance', 'breeze', 'echoes', 'melody', 'rhythm', 'spiral', 'signal', 'beacon',
    'orbit', 'vortex', 'matrix', 'riddle', 'legend', 'arcade', 'galaxy', 'harbor', 'summit', 'horizon'
];

// In-memory store of users currently being challenged: userId -> { word, guildId, expires }
const pending = new Map();
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

function randomWord() {
    return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

// Returns { ok: true } or { ok: false, reason } so callers can explain exactly
// what went wrong (the usual culprit is role hierarchy).
async function grantRole(member) {
    if (!VERIFIED_ROLE_ID || VERIFIED_ROLE_ID === 'PUT_VERIFIED_ROLE_ID_HERE') {
        return { ok: false, reason: 'unconfigured' };
    }
    const guild = member.guild;
    const me = guild.members.me;
    const role = guild.roles.cache.get(VERIFIED_ROLE_ID);
    if (!role) return { ok: false, reason: 'missing_role' };
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return { ok: false, reason: 'no_perm' };
    // The bot can only assign roles positioned BELOW its own highest role.
    if (me.roles.highest.comparePositionTo(role) <= 0) return { ok: false, reason: 'hierarchy' };
    try {
        await member.roles.add(role);
        return { ok: true };
    } catch (err) {
        console.error('[verify] roles.add failed:', err);
        return { ok: false, reason: 'error' };
    }
}

const GRANT_FAIL_MESSAGES = {
    unconfigured: '⚠️ The verified role isn\'t configured yet. Please contact an admin.',
    missing_role: '⚠️ The verified role no longer exists. Please contact an admin.',
    no_perm: '⚠️ I\'m missing the **Manage Roles** permission. An admin needs to enable it for me.',
    hierarchy: '⚠️ My role is **below** the verified role, so Discord won\'t let me assign it. An admin needs to drag my bot role **above** the verified role in Server Settings → Roles.',
    error: '⚠️ I couldn\'t assign your role. Please contact an admin.'
};

module.exports = {
    VERIFIED_ROLE_ID,

    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Post the verification panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Verify!')
            .setDescription('Verify your roblox account to gain access to the rest of the server!')
            .setColor('#3b82f6');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_start')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: 'Verification panel posted!', flags: [MessageFlags.Ephemeral] });
    },

    // --- Helpers called by index.js ---

    // Button press: DM the user a word to spell.
    async handleVerifyButton(interaction) {
        if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
            return interaction.reply({ content: '✅ You are already verified!', flags: [MessageFlags.Ephemeral] });
        }

        const word = randomWord();
        pending.set(interaction.user.id, {
            word,
            guildId: interaction.guildId,
            expires: Date.now() + CHALLENGE_TTL
        });

        const dm = new EmbedBuilder()
            .setTitle('🔐 Verification Challenge')
            .setDescription(`To verify in **${interaction.guild.name}**, reply to this message by spelling the word below exactly:\n\n# \`${word}\`\n\nYou have 5 minutes.`)
            .setColor('#3b82f6');

        try {
            await interaction.user.send({ embeds: [dm] });
        } catch {
            pending.delete(interaction.user.id);
            return interaction.reply({
                content: '❌ I couldn\'t DM you. Please enable **Direct Messages** from server members and try again.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        return interaction.reply({ content: '📨 Check your DMs to complete verification!', flags: [MessageFlags.Ephemeral] });
    },

    // DM reply: check the spelled word and assign the role.
    async handleVerifyDM(message, client) {
        const challenge = pending.get(message.author.id);
        if (!challenge) return;

        if (Date.now() > challenge.expires) {
            pending.delete(message.author.id);
            return message.reply('⏰ Your verification expired. Press the **Verify** button again to get a new word.');
        }

        if (message.content.trim().toLowerCase() !== challenge.word) {
            return message.reply(`❌ That's not right. Spell this word exactly: \`${challenge.word}\``);
        }

        pending.delete(message.author.id);

        const guild = client.guilds.cache.get(challenge.guildId);
        const member = guild ? await guild.members.fetch(message.author.id).catch(() => null) : null;
        if (!member) {
            return message.reply('⚠️ I couldn\'t find you in the server anymore. Please rejoin and try again.');
        }

        const res = await grantRole(member);
        if (res.ok) return message.reply(`✅ You're verified in **${guild.name}**! Welcome aboard.`);
        return message.reply(GRANT_FAIL_MESSAGES[res.reason] || GRANT_FAIL_MESSAGES.error);
    },

    // New member joins: bots skip the captcha and are verified automatically.
    async autoVerifyBot(member) {
        if (!member.user.bot) return;
        const res = await grantRole(member);
        if (!res.ok) console.warn('[verify] could not auto-verify bot:', res.reason);
    }
};

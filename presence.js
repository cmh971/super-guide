const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActivityType } = require('discord.js');
const mongoose = require('mongoose');

// Stores the bot's chosen presence so it survives restarts.
const presenceSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true },
    status: { type: String, default: 'online' },   // online | idle | dnd | invisible
    type: { type: String, default: 'watching' },   // watching | playing | listening | competing | streaming
    text: { type: String, default: 'over the trees 🌴' }
});
const PresenceConfig = mongoose.models.PresenceConfig || mongoose.model('PresenceConfig', presenceSchema);

const TYPE_MAP = {
    playing: ActivityType.Playing,
    watching: ActivityType.Watching,
    listening: ActivityType.Listening,
    competing: ActivityType.Competing,
    streaming: ActivityType.Streaming
};

// Read the saved presence (or defaults) and apply it to the bot.
async function applyPresence(client) {
    const cfg = await PresenceConfig.findOne({ key: 'global' }).catch(() => null);
    const status = cfg?.status || 'online';
    const typeKey = cfg?.type || 'watching';
    const text = cfg?.text || 'over the trees 🌴';
    try {
        client.user.setPresence({
            status,
            activities: [{ name: text, type: TYPE_MAP[typeKey] ?? ActivityType.Watching }]
        });
    } catch (err) {
        console.error('[presence] failed to apply:', err.message);
    }
    return { status, typeKey, text };
}

module.exports = {
    applyPresence,

    data: new SlashCommandBuilder()
        .setName('presence')
        .setDescription("Set the bot's status and what it's watching/playing")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o =>
            o.setName('status')
                .setDescription('The bot status indicator')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Online', value: 'online' },
                    { name: '🌙 Idle', value: 'idle' },
                    { name: '⛔ Do Not Disturb', value: 'dnd' },
                    { name: '⚫ Invisible', value: 'invisible' }
                ))
        .addStringOption(o =>
            o.setName('type')
                .setDescription('Activity type (default: Watching)')
                .setRequired(false)
                .addChoices(
                    { name: 'Watching', value: 'watching' },
                    { name: 'Playing', value: 'playing' },
                    { name: 'Listening to', value: 'listening' },
                    { name: 'Competing in', value: 'competing' }
                ))
        .addStringOption(o =>
            o.setName('text')
                .setDescription('What it is watching/playing (default: over the trees)')
                .setRequired(false)),

    async execute(interaction) {
        const status = interaction.options.getString('status');
        const existing = await PresenceConfig.findOne({ key: 'global' }).catch(() => null);
        const type = interaction.options.getString('type') || existing?.type || 'watching';
        const text = interaction.options.getString('text') || existing?.text || 'over the trees 🌴';

        await PresenceConfig.findOneAndUpdate(
            { key: 'global' },
            { key: 'global', status, type, text },
            { upsert: true }
        );

        const applied = await applyPresence(interaction.client);

        const labels = { online: '🟢 Online', idle: '🌙 Idle', dnd: '⛔ Do Not Disturb', invisible: '⚫ Invisible' };
        const verb = { watching: 'Watching', playing: 'Playing', listening: 'Listening to', competing: 'Competing in', streaming: 'Streaming' };
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✅ Presence updated')
            .setDescription(`Status: **${labels[applied.status] || applied.status}**\nActivity: **${verb[applied.typeKey] || applied.typeKey} ${applied.text}**`);

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

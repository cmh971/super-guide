const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const mongoose = require('mongoose');

// Remembers the lockdown state per guild so /lockdown disable can reverse it.
const lockdownSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    active: { type: Boolean, default: false },
    roleId: String,
    lockChannelId: String
});
const Lockdown = mongoose.models.Lockdown || mongoose.model('Lockdown', lockdownSchema);

/**
 * Emoji used in the lockdown notice.
 *
 * These are Unicode emojis so they work with no setup. Discord custom emojis
 * must be PNG/GIF (not SVG), so once you upload assets/icon.svg (converted to
 * PNG) as a server emoji, swap the value below for `<:notallowed:EMOJI_ID>`.
 */
const E = {
    notallowed: '🚫',
    alarm: '🚨',
    space: '　', // wide blank used for indentation
    arrowRight: '➡️'
};

function lockdownEmbed() {
    return new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle(`${E.notallowed} Server is currently locked!`)
        .setDescription(
            `${E.alarm} This server has been completely locked down by staff.\n\n` +
            `${E.space}${E.arrowRight} You will not be able to see or talk in channels until this lockdown is lifted.\n` +
            `${E.space}${E.arrowRight} Please be patient until everything is sorted out.`
        )
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock the entire server so only one role can see anything')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s =>
            s.setName('enable')
                .setDescription('Lock down the whole server')
                .addRoleOption(o =>
                    o.setName('role')
                        .setDescription('The only role that keeps access during lockdown')
                        .setRequired(true)))
        .addSubcommand(s =>
            s.setName('disable')
                .setDescription('Lift the lockdown and restore access')),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const everyoneId = interaction.guild.id; // @everyone role id == guild id
        await interaction.deferReply({ ephemeral: true });

        // ---------------------------------------------------------------- ENABLE
        if (sub === 'enable') {
            const role = interaction.options.getRole('role');

            // 1) Create the single visible "you are locked" channel.
            const lockChannel = await interaction.guild.channels.create({
                name: '🔒-server-locked',
                type: ChannelType.GuildText,
                position: 0,
                permissionOverwrites: [
                    // Everyone can SEE this channel but not talk in it.
                    { id: everyoneId, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions] },
                    // The chosen role keeps full access.
                    { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            }).catch(() => null);

            if (!lockChannel) {
                return interaction.editReply('❌ I couldn\'t create the lockdown channel. Check my **Manage Channels** permission and role position.');
            }

            // 2) Hide every other channel from @everyone, keep it open for the role.
            let locked = 0;
            let failed = 0;
            for (const channel of interaction.guild.channels.cache.values()) {
                if (channel.id === lockChannel.id) continue;
                if (!channel.manageable) { failed++; continue; }
                try {
                    await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: false });
                    await channel.permissionOverwrites.edit(role.id, { ViewChannel: true });
                    locked++;
                } catch {
                    failed++;
                }
            }

            // 3) Post + pin the notice.
            const msg = await lockChannel.send({ embeds: [lockdownEmbed()] }).catch(() => null);
            if (msg) await msg.pin().catch(() => null);

            await Lockdown.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { guildId: interaction.guild.id, active: true, roleId: role.id, lockChannelId: lockChannel.id },
                { upsert: true }
            );

            return interaction.editReply(
                `🔒 **Server locked down.** ${role} keeps access.\n` +
                `• Locked **${locked}** channels${failed ? ` (couldn't touch ${failed} — likely above my role)` : ''}\n` +
                `• Notice posted & pinned in ${lockChannel}`
            );
        }

        // --------------------------------------------------------------- DISABLE
        if (sub === 'disable') {
            const cfg = await Lockdown.findOne({ guildId: interaction.guild.id }).catch(() => null);
            if (!cfg || !cfg.active) {
                return interaction.editReply('❌ This server is not currently locked down.');
            }

            // Restore: remove the @everyone view-deny we added on each channel.
            let restored = 0;
            for (const channel of interaction.guild.channels.cache.values()) {
                if (channel.id === cfg.lockChannelId) continue;
                if (!channel.manageable) continue;
                try {
                    await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: null });
                    if (cfg.roleId) await channel.permissionOverwrites.edit(cfg.roleId, { ViewChannel: null });
                    restored++;
                } catch {
                    /* skip channels we can't manage */
                }
            }

            // Remove the lockdown channel.
            const lockChannel = interaction.guild.channels.cache.get(cfg.lockChannelId);
            if (lockChannel) await lockChannel.delete().catch(() => null);

            cfg.active = false;
            await cfg.save();

            return interaction.editReply(`🔓 **Lockdown lifted.** Restored access on **${restored}** channels.`);
        }
    }
};

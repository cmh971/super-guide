const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require('discord.js');
const { VERIFIED_ROLE_ID } = require('./verify.js');

// Channel types that support permission overwrites we care about.
const MANAGEABLE_TYPES = [
    ChannelType.GuildCategory,
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildStageVoice
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify-setup')
        .setDescription('Lock the whole server behind verification and post the verify panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to use as the verify gate (a #verify channel is created if omitted)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const guild = interaction.guild;
        const everyoneId = guild.roles.everyone.id;
        const verifiedRole = guild.roles.cache.get(VERIFIED_ROLE_ID);

        if (!verifiedRole) {
            return interaction.editReply(`❌ Verified role \`${VERIFIED_ROLE_ID}\` not found. Fix VERIFIED_ROLE_ID in verify.js.`);
        }

        // 1. Find or create the verify gate channel.
        let verifyChannel = interaction.options.getChannel('channel');
        if (!verifyChannel) {
            verifyChannel = guild.channels.cache.find(c => c.name === 'verify' && c.type === ChannelType.GuildText)
                || await guild.channels.create({ name: 'verify', type: ChannelType.GuildText });
        }

        // 2. Lock every other channel: hide from @everyone, reveal to Verified.
        let locked = 0;
        for (const channel of guild.channels.cache.values()) {
            if (channel.id === verifyChannel.id) continue;
            if (!MANAGEABLE_TYPES.includes(channel.type)) continue;
            try {
                await channel.permissionOverwrites.edit(everyoneId, { ViewChannel: false });
                await channel.permissionOverwrites.edit(verifiedRole.id, { ViewChannel: true });
                locked++;
            } catch (err) {
                console.error(`[verify-setup] could not lock #${channel.name}:`, err.message);
            }
        }

        // 3. Make the gate channel public to view but read-only, and hidden from people who already verified.
        try {
            await verifyChannel.permissionOverwrites.edit(everyoneId, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: false,
                AddReactions: false
            });
            await verifyChannel.permissionOverwrites.edit(verifiedRole.id, { ViewChannel: false });
        } catch (err) {
            console.error('[verify-setup] could not configure gate channel:', err.message);
        }

        // 4. Auto-verify bots already in the server (they can't click the button).
        let bots = 0;
        const members = await guild.members.fetch().catch(() => null);
        if (members) {
            for (const member of members.values()) {
                if (member.user.bot && !member.roles.cache.has(verifiedRole.id)) {
                    if (await member.roles.add(verifiedRole.id).then(() => true).catch(() => false)) bots++;
                }
            }
        }

        // 5. Post the verify panel (same button the existing handler listens for).
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

        await verifyChannel.send({ embeds: [embed], components: [row] });

        return interaction.editReply(
            `✅ Verification gate is live.\n` +
            `• Locked **${locked}** channels behind the **${verifiedRole.name}** role\n` +
            `• Gate channel: ${verifyChannel}\n` +
            `• Auto-verified **${bots}** existing bot(s)`
        );
    }
};

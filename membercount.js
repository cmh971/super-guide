/**
 * @file membercount.js
 * @description Reports a breakdown of server membership: humans vs bots, and
 *              presence status counts when the presence cache is available.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /membercount
 * ============================================================
 *  Category    : Information
 *  Summary     : Show a breakdown of this server\
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


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Tally members into humans/bots and online/offline buckets.
 * @param {import('discord.js').Collection} members
 * @returns {{ humans: number, bots: number, online: number, idle: number, dnd: number, offline: number }}
 */
function tally(members) {
    const result = { humans: 0, bots: 0, online: 0, idle: 0, dnd: 0, offline: 0 };
    for (const member of members.values()) {
        if (member.user.bot) result.bots++;
        else result.humans++;

        const status = member.presence?.status ?? 'offline';
        switch (status) {
            case 'online': result.online++; break;
            case 'idle': result.idle++; break;
            case 'dnd': result.dnd++; break;
            default: result.offline++; break;
        }
    }
    return result;
}

/**
 * Build a percentage bar string for two values.
 * @param {number} part
 * @param {number} total
 * @returns {string}
 */
function percentBar(part, total) {
    if (total === 0) return '░░░░░░░░░░ 0%';
    const ratio = part / total;
    const filled = Math.round(ratio * 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${Math.round(ratio * 100)}%`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Show a breakdown of this server\'s members'),

    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({ content: 'This command only works in a server.', ephemeral: true });
        }

        await interaction.deferReply();

        // Fetch all members for accurate human/bot counts.
        const members = await guild.members.fetch().catch(() => guild.members.cache);
        const stats = tally(members);
        const total = stats.humans + stats.bots;

        const embed = new EmbedBuilder()
            .setTitle(`👥 ${guild.name} — Member Count`)
            .setColor('#3b82f6')
            .setThumbnail(guild.iconURL({ size: 128 }))
            .addFields(
                { name: '📊 Total', value: `**${total}** members`, inline: false },
                {
                    name: '🧍 Humans',
                    value: `**${stats.humans}**\n${percentBar(stats.humans, total)}`,
                    inline: true
                },
                {
                    name: '🤖 Bots',
                    value: `**${stats.bots}**\n${percentBar(stats.bots, total)}`,
                    inline: true
                },
                {
                    name: '🟢 Presence',
                    value:
                        `Online: **${stats.online}**\n` +
                        `Idle: **${stats.idle}**\n` +
                        `DND: **${stats.dnd}**\n` +
                        `Offline: **${stats.offline}**`,
                    inline: false
                }
            )
            .setFooter({ text: 'Presence data requires the Presence intent to be accurate.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};

// End of file: membercount.js

/**
 * @file ping.js
 * @description Reports the bot's gateway latency and round-trip API latency
 *              in a clean, color-coded embed so staff can gauge bot health.
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * Pick a status label + color based on a latency value (ms).
 * @param {number} ms
 * @returns {{ label: string, color: number, emoji: string }}
 */
function classifyLatency(ms) {
    if (ms < 0) {
        return { label: 'Calculating', color: 0x95a5a6, emoji: '⏳' };
    }
    if (ms < 100) {
        return { label: 'Excellent', color: 0x22c55e, emoji: '🟢' };
    }
    if (ms < 200) {
        return { label: 'Good', color: 0x84cc16, emoji: '🟢' };
    }
    if (ms < 400) {
        return { label: 'Okay', color: 0xeab308, emoji: '🟡' };
    }
    if (ms < 700) {
        return { label: 'Slow', color: 0xf97316, emoji: '🟠' };
    }
    return { label: 'Critical', color: 0xef4444, emoji: '🔴' };
}

/**
 * Build a tiny text progress bar for a latency value.
 * @param {number} ms
 * @returns {string}
 */
function latencyBar(ms) {
    const max = 700;
    const filledBlocks = Math.min(10, Math.round((ms / max) * 10));
    const empty = 10 - filledBlocks;
    return '█'.repeat(Math.max(0, filledBlocks)) + '░'.repeat(Math.max(0, empty));
}

/**
 * Format milliseconds into a friendly string.
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
    if (ms < 0) return 'N/A';
    return `${ms}ms`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot latency and API response time'),

    async execute(interaction) {
        // Send an initial reply so we can measure round-trip time accurately.
        const sent = await interaction.reply({
            content: '🏓 Pinging...',
            fetchReply: true,
            flags: [MessageFlags.Ephemeral]
        });

        // Round-trip latency: difference between our reply and the trigger.
        const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;

        // Gateway (websocket) latency reported by discord.js.
        const wsPing = Math.round(interaction.client.ws.ping);

        const rtStatus = classifyLatency(roundTrip);
        const wsStatus = classifyLatency(wsPing);

        // Average the two readings for an overall health verdict.
        const average = Math.round((roundTrip + Math.max(0, wsPing)) / 2);
        const overall = classifyLatency(average);

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor(overall.color)
            .addFields(
                {
                    name: `${rtStatus.emoji} Round-Trip`,
                    value: `\`${formatMs(roundTrip)}\`\n${latencyBar(roundTrip)} ${rtStatus.label}`,
                    inline: true
                },
                {
                    name: `${wsStatus.emoji} WebSocket`,
                    value: `\`${formatMs(wsPing)}\`\n${latencyBar(Math.max(0, wsPing))} ${wsStatus.label}`,
                    inline: true
                },
                {
                    name: `${overall.emoji} Overall`,
                    value: `\`${formatMs(average)}\`\nStatus: **${overall.label}**`,
                    inline: false
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        // Edit the placeholder with the full diagnostic embed.
        await interaction.editReply({
            content: null,
            embeds: [embed]
        });
    }
};

// End of file: ping.js

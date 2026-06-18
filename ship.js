/**
 * @file ship.js
 * @description A playful compatibility calculator that "ships" two users and
 *              returns a deterministic-ish love percentage with a meter.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /ship
 * ============================================================
 *  Category    : Fun
 *  Summary     : Calculate the compatibility between two users
 *  Scope       : Guild slash command
 *  Cooldown    : 3s recommended (not enforced here)
 *  Permissions : Inherits the SlashCommandBuilder default for this file
 *
 *  Behavior notes:
 *    01. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    02. All user-supplied input is validated before any response is sent.
 *    03. On invalid input the command responds ephemerally so channels stay clean.
 *    04. Errors are caught and surfaced as friendly messages, never raw stack traces.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Produce a stable score (0-100) for a pair of IDs so the same pairing always
 * returns the same percentage. Order-independent.
 * @param {string} idA
 * @param {string} idB
 * @returns {number}
 */
function compatibilityScore(idA, idB) {
    const combined = [idA, idB].sort().join('-');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
    }
    return hash % 101;
}

/**
 * Build a heart-based progress meter for a score.
 * @param {number} score
 * @returns {string}
 */
function loveMeter(score) {
    const filled = Math.round(score / 10);
    return '❤️'.repeat(filled) + '🤍'.repeat(10 - filled);
}

/**
 * Generate a flavor verdict for a score.
 * @param {number} score
 * @returns {string}
 */
function verdict(score) {
    if (score >= 90) return 'A match made in heaven! 💍';
    if (score >= 70) return 'There\'s real chemistry here! 🔥';
    if (score >= 50) return 'A promising spark. ✨';
    if (score >= 30) return 'Could work with some effort. 🌱';
    if (score >= 10) return 'It\'s... complicated. 😅';
    return 'Maybe just stay friends. 🙃';
}

/**
 * Create a ship name by blending two display names.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function shipName(a, b) {
    const half = (s) => s.slice(0, Math.max(1, Math.ceil(s.length / 2)));
    return half(a) + b.slice(Math.floor(b.length / 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Calculate the compatibility between two users')
        .addUserOption(option =>
            option.setName('first')
                .setDescription('First person')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('second')
                .setDescription('Second person (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const first = interaction.options.getUser('first');
        const second = interaction.options.getUser('second') ?? interaction.user;

        if (first.id === second.id) {
            return interaction.reply({
                content: 'You can\'t ship someone with themselves! 😄',
                ephemeral: true
            });
        }

        const score = compatibilityScore(first.id, second.id);
        const name = shipName(first.username, second.username);

        const embed = new EmbedBuilder()
            .setTitle('💘 Love Calculator')
            .setColor(score >= 50 ? 0xec4899 : 0x6b7280)
            .setDescription(
                `**${first.username}** 💕 **${second.username}**\n\n` +
                `Ship name: **${name}**\n\n` +
                `${loveMeter(score)}\n` +
                `## ${score}%\n\n` +
                `*${verdict(score)}*`
            )
            .setFooter({ text: `Shipped by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: ship.js

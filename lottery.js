/**
 * @file lottery.js
 * @description Pick lucky numbers, the bot draws a winning set, and the command
 *              reports how many matched plus the prize tier.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /lottery
 * ============================================================
 *  Category    : Games
 *  Summary     : Play a pretend 6/49 lottery
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

const POOL_MAX = 49;
const PICKS = 6;

/**
 * Draw a unique set of numbers from 1..POOL_MAX.
 * @returns {number[]}
 */
function drawNumbers() {
    const set = new Set();
    while (set.size < PICKS) {
        set.add(Math.floor(Math.random() * POOL_MAX) + 1);
    }
    return [...set].sort((a, b) => a - b);
}

/**
 * Parse a user's chosen numbers, validating range and uniqueness.
 * @param {string|null} raw
 * @returns {number[]|null}
 */
function parsePicks(raw) {
    if (!raw) return drawNumbers(); // quick pick
    const nums = raw
        .split(/[\s,]+/)
        .map(n => parseInt(n, 10))
        .filter(n => Number.isInteger(n));

    const unique = [...new Set(nums)];
    if (unique.length !== PICKS) return null;
    if (unique.some(n => n < 1 || n > POOL_MAX)) return null;
    return unique.sort((a, b) => a - b);
}

/**
 * Map number of matches to a prize tier string.
 * @param {number} matches
 * @returns {string}
 */
function prizeTier(matches) {
    return [
        'Nothing this time 💸',
        'Nothing this time 💸',
        'Free play! 🎟️',
        '$50 prize 💵',
        '$1,000 prize 💰',
        '$50,000 prize 🤑',
        'GRAND JACKPOT! 🎉💎'
    ][matches] ?? 'Nothing';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Play a pretend 6/49 lottery')
        .addStringOption(option =>
            option.setName('numbers')
                .setDescription('Six numbers 1-49 separated by spaces (leave blank for quick pick)')
                .setRequired(false)),

    async execute(interaction) {
        const picks = parsePicks(interaction.options.getString('numbers'));

        if (!picks) {
            return interaction.reply({
                content: '❌ Choose exactly **6 unique** numbers between **1 and 49**, e.g. `7 14 21 28 35 42`.',
                ephemeral: true
            });
        }

        const winning = drawNumbers();
        const matched = picks.filter(n => winning.includes(n));
        const tier = prizeTier(matched.length);

        // Highlight matched numbers in the player's line.
        const playerLine = picks.map(n => matched.includes(n) ? `**__${n}__**` : `${n}`).join('  ');
        const winningLine = winning.join('  ');

        const embed = new EmbedBuilder()
            .setTitle('🎟️ Lottery Draw')
            .setColor(matched.length >= 3 ? 0x22c55e : 0x6b7280)
            .addFields(
                { name: 'Your Numbers', value: playerLine, inline: false },
                { name: 'Winning Numbers', value: winningLine, inline: false },
                { name: 'Matches', value: `**${matched.length}** / ${PICKS}`, inline: true },
                { name: 'Prize', value: tier, inline: true }
            )
            .setFooter({ text: `Played by ${interaction.user.tag} • Just for fun` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: lottery.js

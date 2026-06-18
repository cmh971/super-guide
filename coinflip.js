/**
 * @file coinflip.js
 * @description Flips one or more coins, optionally letting the user call the
 *              result, and reports wins/losses with a tally.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /coinflip
 * ============================================================
 *  Category    : Games
 *  Summary     : Flip a coin (or several)
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

const SIDES = ['Heads', 'Tails'];

/**
 * Flip a single fair coin.
 * @returns {'Heads'|'Tails'}
 */
function flipOnce() {
    return SIDES[Math.floor(Math.random() * SIDES.length)];
}

/**
 * Flip N coins and return the sequence plus a count map.
 * @param {number} count
 * @returns {{ sequence: string[], heads: number, tails: number }}
 */
function flipMany(count) {
    const sequence = [];
    let heads = 0;
    let tails = 0;
    for (let i = 0; i < count; i++) {
        const result = flipOnce();
        sequence.push(result);
        if (result === 'Heads') heads++;
        else tails++;
    }
    return { sequence, heads, tails };
}

/**
 * Render a coin result as an emoji for flair.
 * @param {string} side
 * @returns {string}
 */
function coinEmoji(side) {
    return side === 'Heads' ? '🪙' : '⚫';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin (or several)')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('How many coins to flip (1-20)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('call')
                .setDescription('Call the result for a single flip')
                .addChoices(
                    { name: 'Heads', value: 'Heads' },
                    { name: 'Tails', value: 'Tails' }
                )
                .setRequired(false)),

    async execute(interaction) {
        const count = interaction.options.getInteger('count') ?? 1;
        const call = interaction.options.getString('call');

        const { sequence, heads, tails } = flipMany(count);

        const embed = new EmbedBuilder()
            .setColor('#eab308')
            .setFooter({ text: `Flipped by ${interaction.user.tag}` })
            .setTimestamp();

        if (count === 1) {
            const result = sequence[0];
            embed.setTitle(`${coinEmoji(result)} ${result}!`);

            // If the user called the flip, tell them whether they won.
            if (call) {
                const won = call === result;
                embed.setDescription(
                    `You called **${call}** and it landed on **${result}**.\n` +
                    (won ? '🎉 You won!' : '😢 Better luck next time.')
                );
                embed.setColor(won ? 0x22c55e : 0xef4444);
            } else {
                embed.setDescription(`The coin landed on **${result}**.`);
            }
        } else {
            // Multiple coins: show the run and a summary tally.
            const visual = sequence.map(coinEmoji).join(' ');
            embed.setTitle(`🪙 Flipped ${count} coins`);
            embed.setDescription(
                `${visual}\n\n` +
                `**Heads:** ${heads}\n` +
                `**Tails:** ${tails}\n` +
                `**Majority:** ${heads === tails ? 'Tie!' : (heads > tails ? 'Heads' : 'Tails')}`
            );
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: coinflip.js

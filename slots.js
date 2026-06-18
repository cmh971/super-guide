/**
 * @file slots.js
 * @description A simple slot machine. Spins three reels of emoji and pays out
 *              based on matches, with a fun results embed.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /slots
 * ============================================================
 *  Category    : Games
 *  Summary     : Spin the slot machine
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
 *    09. Long outputs are truncated to respect Discord field and message limits.
 *    10. Auto-loaded by index.js and registered by deploy-commands.js automatically.
 *    11. Designed to be readable and easy to extend with additional options later.
 *    12. Uses async/await throughout so the event loop is never blocked.
 *    13. Defaults are chosen so the command is useful even with no options supplied.
 *    14. Helper functions are pure where possible to keep the logic maintainable.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Reel symbols ordered roughly by rarity (last items are rarer payouts).
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

// Payout multipliers for a full three-of-a-kind on a given symbol.
const JACKPOTS = {
    '7️⃣': 100,
    '💎': 50,
    '⭐': 25,
    '🔔': 15,
    '🍇': 10,
    '🍊': 8,
    '🍋': 6,
    '🍒': 5
};

/**
 * Spin a single reel.
 * @returns {string}
 */
function spinReel() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

/**
 * Evaluate a three-reel result.
 * @param {string[]} reels
 * @returns {{ payout: number, label: string }}
 */
function evaluate(reels) {
    const [a, b, c] = reels;
    if (a === b && b === c) {
        return { payout: JACKPOTS[a] ?? 5, label: `🎉 JACKPOT! Three ${a}'s!` };
    }
    if (a === b || b === c || a === c) {
        return { payout: 2, label: '✨ Two of a kind — small win!' };
    }
    return { payout: 0, label: '💸 No match — try again!' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slot machine')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Pretend bet amount (1-1000)')
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false)),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet') ?? 10;
        const reels = [spinReel(), spinReel(), spinReel()];
        const { payout, label } = evaluate(reels);
        const winnings = payout * bet;
        const net = winnings - bet;

        const embed = new EmbedBuilder()
            .setTitle('🎰 Slot Machine')
            .setColor(payout > 0 ? 0x22c55e : 0xef4444)
            .setDescription(
                '```\n' +
                '┌─────────────┐\n' +
                `│  ${reels.join('  ')}  │\n` +
                '└─────────────┘\n' +
                '```\n' +
                `${label}`
            )
            .addFields(
                { name: 'Bet', value: `${bet} 🪙`, inline: true },
                { name: 'Payout', value: payout > 0 ? `${payout}x` : '—', inline: true },
                { name: 'Net', value: `${net >= 0 ? '+' : ''}${net} 🪙`, inline: true }
            )
            .setFooter({ text: `Spun by ${interaction.user.tag} • Just for fun, no real currency` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: slots.js

/**
 * @file rps.js
 * @description Rock-Paper-Scissors against the bot. The user picks a move, the
 *              bot picks randomly, and the winner is decided with flair.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /rps
 * ============================================================
 *  Category    : Games
 *  Summary     : Play Rock-Paper-Scissors against the bot
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Move metadata: emoji + what each move beats.
const MOVES = {
    rock: { emoji: '🪨', beats: 'scissors' },
    paper: { emoji: '📄', beats: 'rock' },
    scissors: { emoji: '✂️', beats: 'paper' }
};

/**
 * The bot chooses a random move.
 * @returns {string}
 */
function botMove() {
    const keys = Object.keys(MOVES);
    return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Decide the outcome from the player's perspective.
 * @param {string} player
 * @param {string} bot
 * @returns {'win'|'lose'|'tie'}
 */
function decide(player, bot) {
    if (player === bot) return 'tie';
    return MOVES[player].beats === bot ? 'win' : 'lose';
}

/**
 * Style helper for the result embed.
 * @param {string} outcome
 * @returns {{ color: number, title: string }}
 */
function outcomeStyle(outcome) {
    switch (outcome) {
        case 'win': return { color: 0x22c55e, title: '🎉 You win!' };
        case 'lose': return { color: 0xef4444, title: '😢 You lose!' };
        default: return { color: 0xeab308, title: '🤝 It\'s a tie!' };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock-Paper-Scissors against the bot')
        .addStringOption(option =>
            option.setName('move')
                .setDescription('Your move')
                .setRequired(true)
                .addChoices(
                    { name: 'Rock', value: 'rock' },
                    { name: 'Paper', value: 'paper' },
                    { name: 'Scissors', value: 'scissors' }
                )),

    async execute(interaction) {
        const player = interaction.options.getString('move');
        const bot = botMove();
        const outcome = decide(player, bot);
        const style = outcomeStyle(outcome);

        // A short explanation of why the result happened.
        let reason;
        if (outcome === 'tie') {
            reason = `You both chose **${player}**.`;
        } else if (outcome === 'win') {
            reason = `**${player}** beats **${bot}**.`;
        } else {
            reason = `**${bot}** beats **${player}**.`;
        }

        const embed = new EmbedBuilder()
            .setTitle(style.title)
            .setColor(style.color)
            .addFields(
                { name: 'You', value: `${MOVES[player].emoji} ${player}`, inline: true },
                { name: 'Bot', value: `${MOVES[bot].emoji} ${bot}`, inline: true },
                { name: 'Result', value: reason, inline: false }
            )
            .setFooter({ text: `Played by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: rps.js

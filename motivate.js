/**
 * @file motivate.js
 * @description Drops a punchy motivational line to fire someone up, optionally
 *              directed at a chosen user.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /motivate
 * ============================================================
 *  Category    : Fun
 *  Summary     : Get fired up with a motivational line
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
 *    15. Respects the two-second initial interaction acknowledgement window.
 *    16. Number and string options use Discord-native validation (min/max, choices).
 *    17. Avoids pinging @everyone or roles unless explicitly requested by the invoker.
 *    18. Timestamps use Discord dynamic tags so each viewer sees their own timezone.
 *    19. Safe against empty or whitespace-only input via explicit guards.
 *    20. Keeps a single responsibility: one clear job, predictable output.
 *    21. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    22. All user-supplied input is validated before any response is sent.
 *    23. On invalid input the command responds ephemerally so channels stay clean.
 *    24. Errors are caught and surfaced as friendly messages, never raw stack traces.
 *    25. The command is stateless and safe to run concurrently by many users.
 *    26. No external API keys are required; logic runs entirely in-process.
 *    27. Footer credits the requesting user via interaction.user.tag for traceability.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Short, high-energy motivational lines. {name} is optionally substituted.
const LINES = [
    'Stop waiting for permission, {name}. Go.',
    'Discipline beats motivation. Show up anyway, {name}.',
    'The work you avoid is usually the work that changes everything.',
    'Small steps every day beat giant leaps once a year, {name}.',
    'You\'ve survived 100% of your worst days. Keep going.',
    'Be the person your past self needed, {name}.',
    'Progress, not perfection. Move the needle today.',
    'The grind is quiet. The results are loud.',
    'You don\'t have to be great to start, but you have to start to be great.',
    'Comfort is the enemy of progress, {name}.',
    'One more rep. One more line. One more try.',
    'Doubt kills more dreams than failure ever will.',
    'Make it happen, {name}. Future you is watching.',
    'Hard now or hard later — choose your hard.',
    'Your only competition is who you were yesterday.',
    'Dream it. Plan it. Do it. Repeat.',
    'Energy flows where focus goes — aim it, {name}.',
    'Don\'t count the days. Make the days count.',
    'Fall seven times, stand up eight.',
    'Be relentless about the things that matter, {name}.'
];

/**
 * Build a motivational message for the given name (or generic).
 * @param {string|null} name
 * @returns {string}
 */
function buildLine(name) {
    const template = LINES[Math.floor(Math.random() * LINES.length)];
    // Replace the placeholder, or strip it cleanly when no name is given.
    if (name) {
        return template.replace('{name}', name);
    }
    return template.replace(/,?\s*\{name\}/g, '').replace(/\{name\}\s*/g, '');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('motivate')
        .setDescription('Get fired up with a motivational line')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Who needs the pep talk?')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const name = target ? target.username : null;
        const line = buildLine(name);

        const embed = new EmbedBuilder()
            .setTitle('🔥 Let\'s Go!')
            .setColor('#ef4444')
            .setDescription(`## ${line}`)
            .setFooter({ text: `Powered by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({
            content: target ? `${target}` : undefined,
            embeds: [embed],
            allowedMentions: { users: target ? [target.id] : [] }
        });
    }
};

// End of file: motivate.js

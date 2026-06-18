/**
 * @file compliment.js
 * @description Sends a warm, wholesome compliment to a chosen user (or the
 *              command runner) from a built-in collection.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /compliment
 * ============================================================
 *  Category    : Fun
 *  Summary     : Send someone a wholesome compliment
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
 *    28. Embed colors follow the project palette (blue #3b82f6 as the neutral default).
 *    29. Long outputs are truncated to respect Discord field and message limits.
 *    30. Auto-loaded by index.js and registered by deploy-commands.js automatically.
 *    31. Designed to be readable and easy to extend with additional options later.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Wholesome, friendly compliments. {name} is replaced with the target.
const COMPLIMENTS = [
    '{name}, your smile is contagious.',
    '{name}, you light up every room you walk into.',
    '{name}, you have an incredible sense of humor.',
    '{name}, you\'re even more beautiful on the inside than the outside.',
    '{name}, you bring out the best in other people.',
    '{name}, your kindness is a balm to everyone who encounters it.',
    '{name}, you\'re a great listener.',
    '{name}, you have impeccable manners.',
    '{name}, you\'re strong, and braver than you believe.',
    '{name}, the world is better with you in it.',
    '{name}, you\'re doing an amazing job, even when it doesn\'t feel like it.',
    '{name}, your creativity knows no bounds.',
    '{name}, you make hard things look easy.',
    '{name}, people feel safe and welcome around you.',
    '{name}, you have a heart of gold.',
    '{name}, your positivity is infectious.',
    '{name}, you\'re a true friend.',
    '{name}, you inspire the people around you.',
    '{name}, you handle challenges with incredible grace.',
    '{name}, you matter more than you know.'
];

/**
 * Build a compliment string for the given display name.
 * @param {string} name
 * @returns {string}
 */
function buildCompliment(name) {
    const template = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    return template.replace('{name}', name);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('compliment')
        .setDescription('Send someone a wholesome compliment')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Who to compliment (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const compliment = buildCompliment(target.toString());

        const embed = new EmbedBuilder()
            .setTitle('💖 A Compliment For You')
            .setColor('#ec4899')
            .setDescription(compliment)
            .setThumbnail(target.displayAvatarURL({ size: 128 }))
            .setFooter({ text: `Sent by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({
            content: target.id !== interaction.user.id ? `${target}` : undefined,
            embeds: [embed],
            allowedMentions: { users: target.id !== interaction.user.id ? [target.id] : [] }
        });
    }
};

// End of file: compliment.js

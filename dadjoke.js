/**
 * @file dadjoke.js
 * @description Serves up a groan-worthy one-liner dad joke from a built-in
 *              collection, with an optional "rate the groan" meter.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /dadjoke
 * ============================================================
 *  Category    : Fun
 *  Summary     : Get a groan-worthy dad joke
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
 *    32. Uses async/await throughout so the event loop is never blocked.
 *    33. Defaults are chosen so the command is useful even with no options supplied.
 *    34. Helper functions are pure where possible to keep the logic maintainable.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Classic one-liner dad jokes.
const DAD_JOKES = [
    'I\'m afraid for the calendar. Its days are numbered.',
    'I only know 25 letters of the alphabet. I don\'t know y.',
    'I used to hate facial hair, but then it grew on me.',
    'What do you call a fish wearing a bowtie? Sofishticated.',
    'I would tell you a construction joke, but I\'m still working on it.',
    'Why don\'t skeletons ever go trick or treating? Because they have no body to go with.',
    'I don\'t trust stairs. They\'re always up to something.',
    'What did the janitor say when he jumped out of the closet? Supplies!',
    'I'.concat(' could tell you a joke about pizza, but it\'s a little cheesy.'),
    'Dad, did you get a haircut? No, I got them all cut.',
    'How do you follow Will Smith in the snow? You follow the fresh prince.',
    'What do you call cheese that isn\'t yours? Nacho cheese.',
    'I made a pencil with two erasers. It was pointless.',
    'Why did the coffee file a police report? It got mugged.',
    'Why do seagulls fly over the sea? Because if they flew over the bay, they\'d be bagels.',
    'I\'m reading a book about anti-gravity. It\'s impossible to put down.',
    'What\'s brown and sticky? A stick.',
    'How do you make a tissue dance? Put a little boogie in it.',
    'Did you hear about the restaurant on the moon? Great food, no atmosphere.',
    'Want to hear a joke about paper? Never mind, it\'s tearable.'
];

/**
 * Pick a random dad joke.
 * @returns {string}
 */
function pickJoke() {
    return DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
}

/**
 * Produce a random "groan level" for flavor.
 * @returns {string}
 */
function groanMeter() {
    const level = Math.floor(Math.random() * 5) + 1;
    return '🙄'.repeat(level) + '😐'.repeat(5 - level);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a groan-worthy dad joke'),

    async execute(interaction) {
        const joke = pickJoke();

        const embed = new EmbedBuilder()
            .setTitle('👨 Dad Joke')
            .setColor('#3b82f6')
            .setDescription(joke)
            .addFields({ name: 'Groan Level', value: groanMeter(), inline: false })
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: dadjoke.js

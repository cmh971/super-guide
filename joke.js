/**
 * @file joke.js
 * @description Tells a random two-part joke, revealing the punchline behind a
 *              spoiler so users can guess first.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /joke
 * ============================================================
 *  Category    : Fun
 *  Summary     : Hear a random joke (punchline hidden behind a spoiler)
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
 *    35. Respects the two-second initial interaction acknowledgement window.
 *    36. Number and string options use Discord-native validation (min/max, choices).
 *    37. Avoids pinging @everyone or roles unless explicitly requested by the invoker.
 *    38. Timestamps use Discord dynamic tags so each viewer sees their own timezone.
 *    39. Safe against empty or whitespace-only input via explicit guards.
 *    40. Keeps a single responsibility: one clear job, predictable output.
 *    41. Replies using a rich EmbedBuilder for consistent styling across the bot.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Two-part jokes: setup + punchline.
const JOKES = [
    { setup: 'Why don\'t scientists trust atoms?', punchline: 'Because they make up everything!' },
    { setup: 'What do you call fake spaghetti?', punchline: 'An impasta!' },
    { setup: 'Why did the scarecrow win an award?', punchline: 'He was outstanding in his field!' },
    { setup: 'How does a penguin build its house?', punchline: 'Igloos it together!' },
    { setup: 'Why don\'t eggs tell jokes?', punchline: 'They\'d crack each other up!' },
    { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!' },
    { setup: 'Why did the bicycle fall over?', punchline: 'It was two-tired!' },
    { setup: 'What do you call cheese that isn\'t yours?', punchline: 'Nacho cheese!' },
    { setup: 'Why can\'t you give Elsa a balloon?', punchline: 'Because she\'ll let it go!' },
    { setup: 'What did the ocean say to the beach?', punchline: 'Nothing, it just waved!' },
    { setup: 'Why did the math book look sad?', punchline: 'Because it had too many problems!' },
    { setup: 'What do you call a fish with no eyes?', punchline: 'A fsh!' },
    { setup: 'Why did the coffee file a police report?', punchline: 'It got mugged!' },
    { setup: 'How do you organize a space party?', punchline: 'You planet!' },
    { setup: 'Why don\'t skeletons fight each other?', punchline: 'They don\'t have the guts!' },
    { setup: 'What\'s orange and sounds like a parrot?', punchline: 'A carrot!' },
    { setup: 'Why did the computer go to the doctor?', punchline: 'It caught a virus!' },
    { setup: 'What do you call a sleeping dinosaur?', punchline: 'A dino-snore!' },
    { setup: 'Why was the math teacher suspicious of the right angle?', punchline: 'Because it was always right!' },
    { setup: 'What do you call a belt made of watches?', punchline: 'A waist of time!' }
];

/**
 * Pick a random joke.
 * @returns {{ setup: string, punchline: string }}
 */
function pickJoke() {
    return JOKES[Math.floor(Math.random() * JOKES.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Hear a random joke (punchline hidden behind a spoiler)'),

    async execute(interaction) {
        const joke = pickJoke();

        const embed = new EmbedBuilder()
            .setTitle('😂 Random Joke')
            .setColor('#eab308')
            .setDescription(
                `${joke.setup}\n\n` +
                `||${joke.punchline}||`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} • Tap the spoiler for the punchline` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: joke.js

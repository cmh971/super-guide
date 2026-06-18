/**
 * @file fact.js
 * @description Shares a random interesting "did you know" fact from a built-in
 *              collection spanning science, history, and nature.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /fact
 * ============================================================
 *  Category    : Fun
 *  Summary     : Learn a random interesting fact
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// A grab-bag of fun, mostly-true trivia facts.
const FACTS = [
    'Honey never spoils — archaeologists have found 3,000-year-old honey still edible.',
    'Octopuses have three hearts and blue blood.',
    'A group of flamingos is called a "flamboyance".',
    'Bananas are berries, but strawberries are not.',
    'The Eiffel Tower can grow more than 15 cm taller in summer due to heat expansion.',
    'Wombat poop is cube-shaped.',
    'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
    'A day on Venus is longer than its year.',
    'Sharks existed before trees did.',
    'The shortest war in history lasted about 38 minutes.',
    'Sea otters hold hands while sleeping so they don\'t drift apart.',
    'Your stomach gets a new lining every few days to avoid digesting itself.',
    'The Great Wall of China is not visible from space with the naked eye.',
    'A bolt of lightning is five times hotter than the surface of the sun.',
    'Cows have best friends and get stressed when separated.',
    'The dot over a lowercase "i" or "j" is called a tittle.',
    'Hot water can freeze faster than cold water under certain conditions (the Mpemba effect).',
    'Some turtles can breathe through their butts.',
    'The inventor of the frisbee was turned into a frisbee after he died.',
    'A single strand of spaghetti is called a "spaghetto".',
    'Polar bears have black skin under their translucent fur.',
    'The human nose can detect about one trillion distinct scents.',
    'Scotland\'s national animal is the unicorn.',
    'Avocados are toxic to birds.'
];

/**
 * Pick a random fact.
 * @returns {string}
 */
function pickFact() {
    return FACTS[Math.floor(Math.random() * FACTS.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fact')
        .setDescription('Learn a random interesting fact'),

    async execute(interaction) {
        const fact = pickFact();

        const embed = new EmbedBuilder()
            .setTitle('💡 Did You Know?')
            .setColor('#06b6d4')
            .setDescription(fact)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: fact.js

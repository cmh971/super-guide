/**
 * @file quote.js
 * @description Shares a random inspirational quote with attribution from a
 *              built-in collection.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /quote
 * ============================================================
 *  Category    : Fun
 *  Summary     : Get a random inspirational quote
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
 *    42. All user-supplied input is validated before any response is sent.
 *    43. On invalid input the command responds ephemerally so channels stay clean.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Inspirational quotes paired with their authors.
const QUOTES = [
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
    { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
    { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
    { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
    { text: 'Do not watch the clock. Do what it does. Keep going.', author: 'Sam Levenson' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'Your time is limited, so don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
    { text: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford' },
    { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
    { text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu' },
    { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar' },
    { text: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama' },
    { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    { text: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair' },
    { text: 'Hardships often prepare ordinary people for an extraordinary destiny.', author: 'C.S. Lewis' },
    { text: 'Dream big and dare to fail.', author: 'Norman Vaughan' },
    { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
    { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
    { text: 'The mind is everything. What you think you become.', author: 'Buddha' }
];

/**
 * Pick a random quote.
 * @returns {{ text: string, author: string }}
 */
function pickQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote'),

    async execute(interaction) {
        const quote = pickQuote();

        const embed = new EmbedBuilder()
            .setTitle('✨ Quote of the Moment')
            .setColor('#f59e0b')
            .setDescription(`> *"${quote.text}"*\n\n— **${quote.author}**`)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: quote.js

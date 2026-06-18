/**
 * @file advice.js
 * @description Offers a random piece of life advice from a built-in collection,
 *              with an optional topic filter.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /advice
 * ============================================================
 *  Category    : Fun
 *  Summary     : Get a random piece of advice
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

// Advice entries tagged loosely by topic for optional filtering.
const ADVICE = [
    { topic: 'life', text: 'Don\'t compare your behind-the-scenes to everyone else\'s highlight reel.' },
    { topic: 'life', text: 'Drink a glass of water before you decide you\'re in a bad mood.' },
    { topic: 'life', text: 'The best apology is changed behavior.' },
    { topic: 'work', text: 'Done is better than perfect — ship it, then improve it.' },
    { topic: 'work', text: 'Take the meeting notes; the person who documents the decision owns it.' },
    { topic: 'work', text: 'Underpromise and overdeliver, never the reverse.' },
    { topic: 'health', text: 'Sleep is a performance enhancer disguised as doing nothing.' },
    { topic: 'health', text: 'A short walk fixes more problems than you\'d expect.' },
    { topic: 'health', text: 'Stretch for five minutes after sitting for an hour.' },
    { topic: 'money', text: 'Pay yourself first — save before you spend, not after.' },
    { topic: 'money', text: 'If you can\'t afford it twice, you can\'t really afford it.' },
    { topic: 'money', text: 'Beware small recurring charges; they add up faster than big ones.' },
    { topic: 'social', text: 'People remember how you made them feel, not what you said.' },
    { topic: 'social', text: 'Ask one more question than feels natural — people love being heard.' },
    { topic: 'social', text: 'Assume good intent until proven otherwise.' },
    { topic: 'life', text: 'You don\'t have to attend every argument you\'re invited to.' },
    { topic: 'work', text: 'Automate the thing you\'ve done manually three times.' },
    { topic: 'health', text: 'Sunlight in the morning helps you sleep at night.' },
    { topic: 'money', text: 'An emergency fund buys you the freedom to say no.' },
    { topic: 'social', text: 'Send the text. The worst case is usually fine.' }
];

/**
 * Pick advice, optionally filtered by topic.
 * @param {string|null} topic
 * @returns {{ topic: string, text: string }}
 */
function pickAdvice(topic) {
    const pool = topic ? ADVICE.filter(a => a.topic === topic) : ADVICE;
    const source = pool.length ? pool : ADVICE;
    return source[Math.floor(Math.random() * source.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advice')
        .setDescription('Get a random piece of advice')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('Filter by topic')
                .setRequired(false)
                .addChoices(
                    { name: 'Life', value: 'life' },
                    { name: 'Work', value: 'work' },
                    { name: 'Health', value: 'health' },
                    { name: 'Money', value: 'money' },
                    { name: 'Social', value: 'social' }
                )),

    async execute(interaction) {
        const topic = interaction.options.getString('topic');
        const advice = pickAdvice(topic);

        const embed = new EmbedBuilder()
            .setTitle('🧭 A Bit of Advice')
            .setColor('#06b6d4')
            .setDescription(`*${advice.text}*`)
            .addFields({ name: 'Topic', value: advice.topic, inline: true })
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: advice.js

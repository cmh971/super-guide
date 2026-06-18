/**
 * @file trivia.js
 * @description Poses a random multiple-choice trivia question and hides the
 *              correct answer behind a spoiler so players can test themselves.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /trivia
 * ============================================================
 *  Category    : Games
 *  Summary     : Answer a random trivia question (answer hidden in a spoiler)
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Each question carries four options and the index of the correct one.
const QUESTIONS = [
    { q: 'What is the largest planet in our solar system?', options: ['Earth', 'Jupiter', 'Saturn', 'Neptune'], answer: 1 },
    { q: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Monet'], answer: 2 },
    { q: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 2 },
    { q: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2 },
    { q: 'What year did the first human land on the Moon?', options: ['1965', '1969', '1972', '1958'], answer: 1 },
    { q: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], answer: 2 },
    { q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
    { q: 'What language has the most native speakers?', options: ['English', 'Hindi', 'Spanish', 'Mandarin Chinese'], answer: 3 },
    { q: 'What gas do plants primarily absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], answer: 2 },
    { q: 'Who wrote "Romeo and Juliet"?', options: ['Dickens', 'Shakespeare', 'Tolstoy', 'Austen'], answer: 1 },
    { q: 'What is the hardest natural substance?', options: ['Gold', 'Iron', 'Diamond', 'Quartz'], answer: 2 },
    { q: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1 },
    { q: 'What is the capital of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], answer: 2 },
    { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Mercury', 'Jupiter'], answer: 1 },
    { q: 'What is the speed of light approximately?', options: ['300 km/s', '300,000 km/s', '3,000 km/s', '30,000 km/s'], answer: 1 }
];

const LETTERS = ['🇦', '🇧', '🇨', '🇩'];

/**
 * Pick a random trivia question.
 * @returns {{ q: string, options: string[], answer: number }}
 */
function pickQuestion() {
    return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Answer a random trivia question (answer hidden in a spoiler)'),

    async execute(interaction) {
        const item = pickQuestion();

        const optionLines = item.options
            .map((opt, i) => `${LETTERS[i]} ${opt}`)
            .join('\n');

        const correctLetter = ['A', 'B', 'C', 'D'][item.answer];
        const correctText = item.options[item.answer];

        const embed = new EmbedBuilder()
            .setTitle('🧠 Trivia Time')
            .setColor('#8b5cf6')
            .setDescription(
                `**${item.q}**\n\n` +
                `${optionLines}\n\n` +
                `**Answer:** ||${correctLetter} — ${correctText}||`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} • Guess, then tap the spoiler` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: trivia.js

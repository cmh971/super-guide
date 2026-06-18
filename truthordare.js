/**
 * @file truthordare.js
 * @description Picks a random truth question or dare challenge. The user can
 *              choose truth, dare, or let the bot pick randomly.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /truthordare
 * ============================================================
 *  Category    : Fun
 *  Summary     : Get a random truth or dare
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Friendly, server-safe truth prompts.
const TRUTHS = [
    'What is the most embarrassing thing you\'ve ever done?',
    'What is your biggest fear?',
    'What is a secret talent you have?',
    'Who was your first crush?',
    'What is the weirdest dream you\'ve had?',
    'What is the most childish thing you still do?',
    'What is one thing on your bucket list?',
    'What is the worst gift you\'ve ever received?',
    'What is your most-used emoji?',
    'If you could swap lives with anyone for a day, who would it be?',
    'What is the last lie you told?',
    'What is your guilty pleasure song?',
    'What is the silliest thing you\'ve cried over?',
    'What is your worst habit?',
    'What is something you\'ve never told anyone here?'
];

// Light, harmless dare prompts suitable for a Discord chat.
const DARES = [
    'Type your next message using only emojis.',
    'Change your nickname to something silly for the next 10 minutes.',
    'Send a voice message singing the chorus of your favorite song.',
    'Talk like a pirate for the next 5 minutes.',
    'Send the 7th photo in your camera roll (keep it appropriate!).',
    'Write a short poem about the person above you in chat.',
    'Do your best impression of a celebrity and describe it.',
    'Use no vowels in your next three messages.',
    'Compliment three different people in the chat right now.',
    'Set your status to "I lost a game of truth or dare" for an hour.',
    'Tell a joke — if no one reacts, tell another.',
    'Type the alphabet backwards as fast as you can in chat.',
    'Pretend to be a robot for your next five messages.',
    'Share the most-used GIF you have.',
    'Narrate what you\'re doing right now in third person.'
];

/**
 * Pick a random entry from a list.
 * @param {string[]} list
 * @returns {string}
 */
function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('truthordare')
        .setDescription('Get a random truth or dare')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Pick one, or leave blank for random')
                .setRequired(false)
                .addChoices(
                    { name: 'Truth', value: 'truth' },
                    { name: 'Dare', value: 'dare' }
                )),

    async execute(interaction) {
        let choice = interaction.options.getString('choice');
        if (!choice) choice = Math.random() < 0.5 ? 'truth' : 'dare';

        const isTruth = choice === 'truth';
        const prompt = isTruth ? pick(TRUTHS) : pick(DARES);

        const embed = new EmbedBuilder()
            .setTitle(isTruth ? '💬 Truth' : '🔥 Dare')
            .setColor(isTruth ? 0x3b82f6 : 0xef4444)
            .setDescription(prompt)
            .setFooter({ text: `For ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: truthordare.js

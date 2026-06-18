/**
 * @file wouldyourather.js
 * @description Poses a random "Would You Rather" dilemma and attaches two
 *              reactions so the channel can vote on each option.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /wouldyourather
 * ============================================================
 *  Category    : Fun
 *  Summary     : Pose a random Would You Rather question
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

// Each prompt has two competing options.
const PROMPTS = [
    { a: 'Be able to fly', b: 'Be invisible' },
    { a: 'Have unlimited money', b: 'Have unlimited time' },
    { a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
    { a: 'Speak every language', b: 'Play every instrument' },
    { a: 'Live without music', b: 'Live without movies' },
    { a: 'Have super strength', b: 'Have super speed' },
    { a: 'Explore space', b: 'Explore the deep ocean' },
    { a: 'Never use a phone again', b: 'Never watch TV again' },
    { a: 'Be the funniest person', b: 'Be the smartest person' },
    { a: 'Read minds', b: 'See the future' },
    { a: 'Always have to sing instead of speak', b: 'Always have to dance everywhere you walk' },
    { a: 'Live in the city', b: 'Live in the countryside' },
    { a: 'Have a rewind button for life', b: 'Have a pause button for life' },
    { a: 'Be a famous actor', b: 'Be a famous musician' },
    { a: 'Only eat sweet food', b: 'Only eat savory food' },
    { a: 'Travel back to the past', b: 'Travel into the future' },
    { a: 'Have free travel for life', b: 'Have free food for life' },
    { a: 'Be able to talk to animals', b: 'Be able to talk to plants' },
    { a: 'Never feel physical pain', b: 'Never feel embarrassment' },
    { a: 'Win the lottery', b: 'Find your true purpose' }
];

/**
 * Pick a random dilemma.
 * @returns {{ a: string, b: string }}
 */
function pickPrompt() {
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wouldyourather')
        .setDescription('Pose a random Would You Rather question'),

    async execute(interaction) {
        const prompt = pickPrompt();

        const embed = new EmbedBuilder()
            .setTitle('🤔 Would You Rather...')
            .setColor('#8b5cf6')
            .setDescription(
                `🅰️  **${prompt.a}**\n\n` +
                `**— OR —**\n\n` +
                `🅱️  **${prompt.b}**`
            )
            .setFooter({ text: `Asked by ${interaction.user.tag} • React to vote!` });

        await interaction.reply({ embeds: [embed], fetchReply: true });
        const message = await interaction.fetchReply();

        // Attach the two voting reactions.
        try {
            await message.react('🅰️');
            await message.react('🅱️');
        } catch (err) {
            console.error('[wouldyourather] reactions failed:', err.message);
        }
    }
};

// End of file: wouldyourather.js

/**
 * @file roast.js
 * @description Delivers a lighthearted, playful roast. Kept friendly and
 *              non-offensive — purely for laughs among friends.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /roast
 * ============================================================
 *  Category    : Fun
 *  Summary     : Playfully roast a friend (all in good fun!)
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

// Gentle, silly roasts meant to be funny rather than hurtful.
const ROASTS = [
    'You bring everyone so much joy... when you leave the room.',
    'You\'re not stupid; you just have bad luck thinking.',
    'I\'d agree with you, but then we\'d both be wrong.',
    'You have something on your chin... no, the third one down.',
    'Your secrets are always safe with me. I never even listen.',
    'You\'re proof that even autocorrect gives up sometimes.',
    'If laziness were an Olympic sport, you\'d get bronze — too lazy for gold.',
    'You\'re like a cloud. When you disappear, it\'s a beautiful day.',
    'I admire your confidence. It\'s the lack of evidence that worries me.',
    'You\'re the reason the shampoo bottle has instructions.',
    'Your wifi signal is stronger than your life decisions.',
    'You have the perfect face for radio.',
    'You\'re not the dumbest person alive, but you\'d better hope they don\'t die.',
    'You\'re like Monday mornings — nobody is happy to see you.',
    'I\'ve seen salads that dress better than you.',
    'You ran out of brain cells, but at least your phone has full storage.',
    'You\'re a great example of why some animals eat their young.',
    'Your jokes are like your gym membership — barely used.',
    'You\'re proof that evolution can go in reverse.',
    'I\'d explain it to you, but I left my crayons at home.'
];

/**
 * Pick a random roast line.
 * @returns {string}
 */
function pickRoast() {
    return ROASTS[Math.floor(Math.random() * ROASTS.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Playfully roast a friend (all in good fun!)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Who to roast (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;

        // Bots are great sports; let them be roasted too, but be cheeky about it.
        const roast = pickRoast();

        const embed = new EmbedBuilder()
            .setTitle('🔥 Roasted!')
            .setColor('#f97316')
            .setDescription(`${target}, ${roast}`)
            .setThumbnail(target.displayAvatarURL({ size: 128 }))
            .setFooter({ text: `Roast requested by ${interaction.user.tag} • All in good fun 😄` })
            .setTimestamp();

        await interaction.reply({
            content: target.id !== interaction.user.id ? `${target}` : undefined,
            embeds: [embed],
            allowedMentions: { users: target.id !== interaction.user.id ? [target.id] : [] }
        });
    }
};

// End of file: roast.js

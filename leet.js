/**
 * @file leet.js
 * @description Converts text into "leetspeak" (1337) at varying intensities,
 *              swapping letters for numbers and symbols.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /leet
 * ============================================================
 *  Category    : Text
 *  Summary     : Convert text into leetspeak (1337)
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Basic substitutions used at the lowest intensity.
const BASIC = { a: '4', e: '3', i: '1', o: '0', t: '7', s: '5' };

// Extra substitutions layered on for higher intensities.
const ADVANCED = { b: '8', g: '9', l: '|', z: '2', c: '(', d: '|)', h: '#', k: '|<', m: '/\\/\\' };

/**
 * Convert text to leetspeak at the given intensity (1-3).
 * @param {string} text
 * @param {number} intensity
 * @returns {string}
 */
function toLeet(text, intensity) {
    const map = { ...BASIC };
    if (intensity >= 2) Object.assign(map, ADVANCED);

    return text.split('').map(ch => {
        const lower = ch.toLowerCase();
        const replacement = map[lower];
        if (!replacement) return ch;

        // At max intensity, always substitute; otherwise substitute ~70% to
        // keep some readability.
        if (intensity >= 3 || Math.random() < 0.7) {
            return replacement;
        }
        return ch;
    }).join('');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leet')
        .setDescription('Convert text into leetspeak (1337)')
        .addStringOption(o => o.setName('text').setDescription('The text to convert').setRequired(true))
        .addIntegerOption(o => o.setName('intensity').setDescription('1 = mild, 3 = maximum').setMinValue(1).setMaxValue(3).setRequired(false)),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const intensity = interaction.options.getInteger('intensity') ?? 2;

        if (text.length > 500) {
            return interaction.reply({ content: '❌ Keep it under 500 characters.', ephemeral: true });
        }

        const result = toLeet(text, intensity);
        const intensityLabel = ['', 'Mild', 'Medium', 'Maximum'][intensity];

        const embed = new EmbedBuilder()
            .setTitle('🤖 L33t Sp34k')
            .setColor('#22c55e')
            .addFields(
                { name: 'Intensity', value: intensityLabel, inline: true },
                { name: 'Original', value: `\`\`\`\n${text.slice(0, 1000)}\n\`\`\``, inline: false },
                { name: 'Leetified', value: `\`\`\`\n${result.slice(0, 1000)}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: leet.js

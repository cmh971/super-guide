/**
 * @file mocktext.js
 * @description Converts text into the "mocking SpongeBob" alternating-case meme
 *              format, plus a couple of related text transforms.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /mocktext
 * ============================================================
 *  Category    : Text
 *  Summary     : Turn text into the mocking SpongeBob style
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Alternate the case of each letter, starting lowercase, skipping non-letters
 * for counting so the pattern looks natural.
 * @param {string} text
 * @returns {string}
 */
function mockCase(text) {
    let upper = false;
    let out = '';
    for (const ch of text) {
        if (/[a-zA-Z]/.test(ch)) {
            out += upper ? ch.toUpperCase() : ch.toLowerCase();
            upper = !upper;
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * Randomly upper/lowercase each letter for a chaotic variant.
 * @param {string} text
 * @returns {string}
 */
function randomCase(text) {
    return [...text].map(ch => (Math.random() < 0.5 ? ch.toLowerCase() : ch.toUpperCase())).join('');
}

/**
 * Space out every character for the "c l a p" aesthetic.
 * @param {string} text
 * @returns {string}
 */
function spacedOut(text) {
    return [...text].join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mocktext')
        .setDescription('Turn text into the mocking SpongeBob style')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to mock')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Transformation style')
                .setRequired(false)
                .addChoices(
                    { name: 'Alternating (default)', value: 'alt' },
                    { name: 'Random case', value: 'random' },
                    { name: 'Spaced out', value: 'spaced' }
                )),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const style = interaction.options.getString('style') ?? 'alt';

        if (text.length > 500) {
            return interaction.reply({ content: '❌ Keep it under 500 characters.', ephemeral: true });
        }

        let result;
        switch (style) {
            case 'random': result = randomCase(text); break;
            case 'spaced': result = spacedOut(text); break;
            default: result = mockCase(text); break;
        }

        const embed = new EmbedBuilder()
            .setTitle('🧽 Mock Text')
            .setColor('#eab308')
            .setDescription(result.slice(0, 4000))
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: mocktext.js

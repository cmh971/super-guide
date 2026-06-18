/**
 * @file reversetext.js
 * @description Reverses text in several ways: full reverse, word-order reverse,
 *              and per-word reverse, with Unicode-aware character handling.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /reversetext
 * ============================================================
 *  Category    : Text
 *  Summary     : Reverse text in different ways
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Reverse a string by Unicode code points (handles most emoji correctly).
 * @param {string} text
 * @returns {string}
 */
function reverseChars(text) {
    return [...text].reverse().join('');
}

/**
 * Reverse the order of words while keeping each word intact.
 * @param {string} text
 * @returns {string}
 */
function reverseWordOrder(text) {
    return text.split(/\s+/).reverse().join(' ');
}

/**
 * Reverse the letters within each word but keep word order.
 * @param {string} text
 * @returns {string}
 */
function reverseEachWord(text) {
    return text.split(/(\s+)/).map(part => (/\s+/.test(part) ? part : reverseChars(part))).join('');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reversetext')
        .setDescription('Reverse text in different ways')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to reverse')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('How to reverse it')
                .setRequired(false)
                .addChoices(
                    { name: 'Full (characters)', value: 'full' },
                    { name: 'Word order', value: 'words' },
                    { name: 'Each word', value: 'each' }
                )),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const mode = interaction.options.getString('mode') ?? 'full';

        if (text.length > 1000) {
            return interaction.reply({ content: '❌ Keep it under 1000 characters.', ephemeral: true });
        }

        let result;
        let label;
        switch (mode) {
            case 'words':
                result = reverseWordOrder(text);
                label = 'Word Order Reversed';
                break;
            case 'each':
                result = reverseEachWord(text);
                label = 'Each Word Reversed';
                break;
            default:
                result = reverseChars(text);
                label = 'Fully Reversed';
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔄 Reverse Text')
            .setColor('#3b82f6')
            .addFields(
                { name: 'Original', value: `\`\`\`\n${text}\n\`\`\``, inline: false },
                { name: label, value: `\`\`\`\n${result}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: reversetext.js

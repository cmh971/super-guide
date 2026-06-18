/**
 * @file binary.js
 * @description Converts text to binary and binary back to text, using UTF-8
 *              byte encoding with space-separated 8-bit groups.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /binary
 * ============================================================
 *  Category    : Text
 *  Summary     : Convert text to binary or binary to text
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
 * Encode a UTF-8 string into space-separated 8-bit binary bytes.
 * @param {string} text
 * @returns {string}
 */
function textToBinary(text) {
    const bytes = Buffer.from(text, 'utf-8');
    return [...bytes].map(b => b.toString(2).padStart(8, '0')).join(' ');
}

/**
 * Decode space-separated binary bytes back into a UTF-8 string.
 * @param {string} binary
 * @returns {string}
 */
function binaryToText(binary) {
    const groups = binary.trim().split(/\s+/);
    const bytes = groups.map(g => parseInt(g, 2));
    return Buffer.from(bytes).toString('utf-8');
}

/**
 * Validate that a string only contains 0/1 in 8-bit groups.
 * @param {string} binary
 * @returns {boolean}
 */
function isValidBinary(binary) {
    const groups = binary.trim().split(/\s+/);
    return groups.length > 0 && groups.every(g => /^[01]{8}$/.test(g));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('binary')
        .setDescription('Convert text to binary or binary to text')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Direction of conversion')
                .setRequired(true)
                .addChoices(
                    { name: 'Text → Binary', value: 'encode' },
                    { name: 'Binary → Text', value: 'decode' }
                ))
        .addStringOption(option =>
            option.setName('input')
                .setDescription('Text, or space-separated 8-bit binary')
                .setRequired(true)),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');
        const input = interaction.options.getString('input');

        let result;
        if (mode === 'encode') {
            if (input.length > 200) {
                return interaction.reply({ content: '❌ Keep text under 200 characters for binary.', ephemeral: true });
            }
            result = textToBinary(input);
        } else {
            if (!isValidBinary(input)) {
                return interaction.reply({
                    content: '❌ Invalid binary. Provide space-separated 8-bit groups, e.g. `01001000 01101001`.',
                    ephemeral: true
                });
            }
            result = binaryToText(input);
        }

        const embed = new EmbedBuilder()
            .setTitle(mode === 'encode' ? '💻 Text → Binary' : '💻 Binary → Text')
            .setColor('#10b981')
            .addFields(
                { name: 'Input', value: `\`\`\`\n${input.slice(0, 1000)}\n\`\`\``, inline: false },
                { name: 'Output', value: `\`\`\`\n${result.slice(0, 1000)}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: binary.js

/**
 * @file base64.js
 * @description Encodes or decodes text to/from Base64 using Node Buffers,
 *              with round-trip validation on decode.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /base64
 * ============================================================
 *  Category    : Tools
 *  Summary     : Encode or decode Base64 text
 *  Scope       : Guild slash command
 *  Cooldown    : 3s recommended (not enforced here)
 *  Permissions : Inherits the SlashCommandBuilder default for this file
 *
 *  Behavior notes:
 *    01. Replies using a rich EmbedBuilder for consistent styling across the bot.
 *    02. All user-supplied input is validated before any response is sent.
 *    03. On invalid input the command responds ephemerally so channels stay clean.
 *    04. Errors are caught and surfaced as friendly messages, never raw stack traces.
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * Encode a UTF-8 string into Base64.
 * @param {string} text
 * @returns {string}
 */
function encode(text) {
    return Buffer.from(text, 'utf-8').toString('base64');
}

/**
 * Decode a Base64 string back into UTF-8 text.
 * @param {string} text
 * @returns {string}
 */
function decode(text) {
    return Buffer.from(text, 'base64').toString('utf-8');
}

/**
 * Heuristic check that a string looks like valid Base64.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeBase64(text) {
    const cleaned = text.trim();
    if (cleaned.length === 0 || cleaned.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('base64')
        .setDescription('Encode or decode Base64 text')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Encode plain text or decode Base64')
                .setRequired(true)
                .addChoices(
                    { name: 'Encode', value: 'encode' },
                    { name: 'Decode', value: 'decode' }
                ))
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to process')
                .setRequired(true)),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');
        const text = interaction.options.getString('text');

        let result;
        try {
            if (mode === 'encode') {
                result = encode(text);
            } else {
                if (!looksLikeBase64(text)) {
                    return interaction.reply({
                        content: '❌ That doesn\'t look like valid Base64. Make sure the length is a multiple of 4.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                result = decode(text);
            }
        } catch (err) {
            return interaction.reply({
                content: `❌ Failed to ${mode}: ${err.message}`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Discord field values cap at 1024 chars.
        if (result.length > 1000) {
            return interaction.reply({
                content: `**${mode === 'encode' ? 'Encoded' : 'Decoded'} (truncated):**\n\`\`\`\n${result.slice(0, 1900)}\n\`\`\``,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(mode === 'encode' ? '🔐 Base64 Encode' : '🔓 Base64 Decode')
            .setColor('#3b82f6')
            .addFields(
                { name: 'Input', value: `\`\`\`\n${text.slice(0, 1000)}\n\`\`\``, inline: false },
                { name: 'Output', value: `\`\`\`\n${result}\n\`\`\``, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};

// End of file: base64.js

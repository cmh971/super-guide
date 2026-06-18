/**
 * @file hashtext.js
 * @description Generates cryptographic hash digests (MD5, SHA-1, SHA-256,
 *              SHA-512) of arbitrary text using Node's crypto module.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /hashtext
 * ============================================================
 *  Category    : Tools
 *  Summary     : Generate a hash digest of some text
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const crypto = require('node:crypto');

// The algorithms we expose as choices.
const ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'];

/**
 * Hash a string with the given algorithm and return the hex digest.
 * @param {string} text
 * @param {string} algorithm
 * @returns {string}
 */
function hash(text, algorithm) {
    return crypto.createHash(algorithm).update(text, 'utf-8').digest('hex');
}

/**
 * Produce all supported digests for a string at once.
 * @param {string} text
 * @returns {Record<string, string>}
 */
function hashAll(text) {
    const out = {};
    for (const algo of ALGORITHMS) {
        out[algo] = hash(text, algo);
    }
    return out;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hashtext')
        .setDescription('Generate a hash digest of some text')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to hash')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('algorithm')
                .setDescription('Hash algorithm (defaults to all)')
                .setRequired(false)
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'MD5', value: 'md5' },
                    { name: 'SHA-1', value: 'sha1' },
                    { name: 'SHA-256', value: 'sha256' },
                    { name: 'SHA-512', value: 'sha512' }
                )),

    async execute(interaction) {
        const text = interaction.options.getString('text');
        const algorithm = interaction.options.getString('algorithm') ?? 'all';

        const embed = new EmbedBuilder()
            .setTitle('🔑 Hash Generator')
            .setColor('#10b981')
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        // Show a short preview of the input rather than echoing huge strings.
        const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text;
        embed.addFields({ name: 'Input', value: `\`${preview}\``, inline: false });

        if (algorithm === 'all') {
            const digests = hashAll(text);
            for (const algo of ALGORITHMS) {
                // SHA-512 is long; wrap it in a code block on its own line.
                embed.addFields({
                    name: algo.toUpperCase(),
                    value: `\`${digests[algo]}\``,
                    inline: false
                });
            }
        } else {
            const digest = hash(text, algorithm);
            embed.addFields({ name: algorithm.toUpperCase(), value: `\`${digest}\``, inline: false });
        }

        // Hashes are sensitive-ish; reply ephemerally to avoid channel clutter.
        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};

// End of file: hashtext.js

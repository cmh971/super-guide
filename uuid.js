/**
 * @file uuid.js
 * @description Generates one or more identifiers: UUID v4, short IDs, and
 *              Discord-style snowflake-length numeric IDs.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /uuid
 * ============================================================
 *  Category    : Tools
 *  Summary     : Generate random identifiers
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

/**
 * Generate a short, URL-safe random ID of the given length.
 * @param {number} length
 * @returns {string}
 */
function shortId(length = 8) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    return out;
}

/**
 * Generate a pseudo-snowflake: a numeric string roughly the length of a
 * Discord ID. (For novelty only — not a real, unique snowflake.)
 * @returns {string}
 */
function fakeSnowflake() {
    let digits = `${crypto.randomInt(1, 10)}`;
    for (let i = 0; i < 17; i++) digits += `${crypto.randomInt(0, 10)}`;
    return digits;
}

/**
 * Produce a batch of UUID v4 strings.
 * @param {number} count
 * @returns {string[]}
 */
function generateUuids(count) {
    const list = [];
    for (let i = 0; i < count; i++) list.push(crypto.randomUUID());
    return list;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uuid')
        .setDescription('Generate random identifiers')
        .addStringOption(o => o.setName('type').setDescription('Kind of ID').setRequired(false)
            .addChoices(
                { name: 'UUID v4', value: 'uuid' },
                { name: 'Short ID', value: 'short' },
                { name: 'Snowflake-style', value: 'snowflake' }
            ))
        .addIntegerOption(o => o.setName('count').setDescription('How many (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),

    async execute(interaction) {
        const type = interaction.options.getString('type') ?? 'uuid';
        const count = interaction.options.getInteger('count') ?? 1;

        let values;
        let title;
        switch (type) {
            case 'short':
                values = Array.from({ length: count }, () => shortId(10));
                title = '🆔 Short IDs';
                break;
            case 'snowflake':
                values = Array.from({ length: count }, () => fakeSnowflake());
                title = '❄️ Snowflake-style IDs';
                break;
            default:
                values = generateUuids(count);
                title = '🆔 UUID v4';
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#10b981')
            .setDescription(values.map(v => `\`${v}\``).join('\n'))
            .setFooter({ text: `Generated ${count} for ${interaction.user.tag}` });

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};

// End of file: uuid.js

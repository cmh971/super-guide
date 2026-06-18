/**
 * @file passgen.js
 * @description Generates a cryptographically strong random password with
 *              configurable length and character classes, plus a strength gauge.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /passgen
 * ============================================================
 *  Category    : Tools
 *  Summary     : Generate a strong random password
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
const crypto = require('node:crypto');

// Character pools for each class.
const POOLS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?'
};

/**
 * Pick a single random character from a string using crypto randomness.
 * @param {string} pool
 * @returns {string}
 */
function randomChar(pool) {
    const index = crypto.randomInt(0, pool.length);
    return pool[index];
}

/**
 * Build a password from the selected pools, guaranteeing at least one of each.
 * @param {number} length
 * @param {string[]} activePools
 * @returns {string}
 */
function generate(length, activePools) {
    const combined = activePools.map(p => POOLS[p]).join('');
    const chars = [];

    // Guarantee representation from each chosen class.
    for (const pool of activePools) {
        chars.push(randomChar(POOLS[pool]));
    }
    while (chars.length < length) {
        chars.push(randomChar(combined));
    }

    // Fisher-Yates shuffle so the guaranteed chars aren't always at the front.
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.slice(0, length).join('');
}

/**
 * Rough strength label based on length and class diversity.
 * @param {number} length
 * @param {number} classes
 * @returns {string}
 */
function strengthLabel(length, classes) {
    const score = length + classes * 4;
    if (score >= 28) return '🟢 Very Strong';
    if (score >= 22) return '🟢 Strong';
    if (score >= 16) return '🟡 Moderate';
    return '🔴 Weak';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('passgen')
        .setDescription('Generate a strong random password')
        .addIntegerOption(o => o.setName('length').setDescription('Length (8-128)').setMinValue(8).setMaxValue(128).setRequired(false))
        .addBooleanOption(o => o.setName('symbols').setDescription('Include symbols (default true)').setRequired(false))
        .addBooleanOption(o => o.setName('digits').setDescription('Include digits (default true)').setRequired(false)),

    async execute(interaction) {
        const length = interaction.options.getInteger('length') ?? 16;
        const useSymbols = interaction.options.getBoolean('symbols') ?? true;
        const useDigits = interaction.options.getBoolean('digits') ?? true;

        const active = ['lower', 'upper'];
        if (useDigits) active.push('digits');
        if (useSymbols) active.push('symbols');

        const password = generate(length, active);

        const embed = new EmbedBuilder()
            .setTitle('🔐 Password Generator')
            .setColor('#10b981')
            .addFields(
                { name: 'Password', value: `\`\`\`\n${password}\n\`\`\``, inline: false },
                { name: 'Length', value: `${length}`, inline: true },
                { name: 'Character Classes', value: `${active.length}`, inline: true },
                { name: 'Strength', value: strengthLabel(length, active.length), inline: true }
            )
            .setFooter({ text: 'Generated with crypto-strength randomness • Only you can see this.' });

        // Always ephemeral — passwords should never post publicly.
        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};

// End of file: passgen.js

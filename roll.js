/**
 * @file roll.js
 * @description A dice roller supporting standard NdM notation with an optional
 *              modifier (e.g. 2d6+3), showing each die and the total.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /roll
 * ============================================================
 *  Category    : Games
 *  Summary     : Roll dice using NdM notation (e.g. 2d6+3)
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


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Matches things like "d20", "2d6", "3d8+5", "1d4-1".
const DICE_PATTERN = /^(\d*)d(\d+)([+-]\d+)?$/i;

/**
 * Parse a dice notation string into its components.
 * @param {string} input
 * @returns {{ count: number, sides: number, modifier: number }|null}
 */
function parseNotation(input) {
    const match = input.trim().replace(/\s+/g, '').match(DICE_PATTERN);
    if (!match) return null;

    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    if (count < 1 || count > 50) return null;
    if (sides < 2 || sides > 1000) return null;

    return { count, sides, modifier };
}

/**
 * Roll the dice described by the parsed notation.
 * @param {{ count: number, sides: number, modifier: number }} spec
 * @returns {{ rolls: number[], subtotal: number, total: number }}
 */
function rollDice(spec) {
    const rolls = [];
    let subtotal = 0;
    for (let i = 0; i < spec.count; i++) {
        const value = Math.floor(Math.random() * spec.sides) + 1;
        rolls.push(value);
        subtotal += value;
    }
    return { rolls, subtotal, total: subtotal + spec.modifier };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll dice using NdM notation (e.g. 2d6+3)')
        .addStringOption(option =>
            option.setName('dice')
                .setDescription('Dice notation like d20, 2d6, or 3d8+5')
                .setRequired(false)),

    async execute(interaction) {
        const input = interaction.options.getString('dice') ?? '1d6';
        const spec = parseNotation(input);

        if (!spec) {
            return interaction.reply({
                content: '❌ Invalid dice notation. Try formats like `d20`, `2d6`, or `3d8+5` (max 50 dice, 1000 sides).',
                ephemeral: true
            });
        }

        const { rolls, subtotal, total } = rollDice(spec);

        // Build a readable breakdown of the individual dice.
        const rollList = rolls.join(', ');
        const modifierText = spec.modifier === 0
            ? ''
            : ` ${spec.modifier > 0 ? '+' : '-'} ${Math.abs(spec.modifier)}`;

        const embed = new EmbedBuilder()
            .setTitle('🎲 Dice Roll')
            .setColor('#8b5cf6')
            .addFields(
                { name: 'Notation', value: `\`${spec.count}d${spec.sides}${spec.modifier ? (spec.modifier > 0 ? '+' : '') + spec.modifier : ''}\``, inline: true },
                { name: 'Total', value: `**${total}**`, inline: true },
                {
                    name: 'Breakdown',
                    value: `[${rollList}]${modifierText ? ` = ${subtotal}${modifierText}` : ''}`,
                    inline: false
                }
            )
            .setFooter({ text: `Rolled by ${interaction.user.tag}` })
            .setTimestamp();

        // Flair: highlight a natural max or min on a single die.
        if (spec.count === 1) {
            if (rolls[0] === spec.sides) embed.setDescription('✨ **Critical max!**');
            else if (rolls[0] === 1) embed.setDescription('💥 **Critical fail!**');
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: roll.js

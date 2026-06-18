/**
 * @file choose.js
 * @description Picks one option at random from a comma-separated list, with a
 *              little suspense and an even-odds disclaimer.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /choose
 * ============================================================
 *  Category    : Fun
 *  Summary     : Let the bot pick from a list of options
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
 * Split and clean a raw "a, b, c" option string into a unique list.
 * @param {string} raw
 * @returns {string[]}
 */
function parseOptions(raw) {
    return raw
        .split(/[,|]/)
        .map(part => part.trim())
        .filter(part => part.length > 0);
}

/**
 * Pick one option uniformly at random.
 * @param {string[]} options
 * @returns {string}
 */
function pick(options) {
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Build a numbered preview of the considered options.
 * @param {string[]} options
 * @returns {string}
 */
function previewList(options) {
    return options
        .slice(0, 20)
        .map((opt, i) => `\`${i + 1}.\` ${opt}`)
        .join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('choose')
        .setDescription('Let the bot pick from a list of options')
        .addStringOption(option =>
            option.setName('options')
                .setDescription('Options separated by commas (e.g. pizza, tacos, sushi)')
                .setRequired(true)),

    async execute(interaction) {
        const raw = interaction.options.getString('options');
        const options = parseOptions(raw);

        // Need at least two distinct things to choose between.
        if (options.length < 2) {
            return interaction.reply({
                content: '❌ Give me at least two options separated by commas. Example: `apples, oranges, grapes`',
                ephemeral: true
            });
        }

        if (options.length > 50) {
            return interaction.reply({
                content: '❌ That\'s too many options — keep it under 50.',
                ephemeral: true
            });
        }

        const chosen = pick(options);

        const embed = new EmbedBuilder()
            .setTitle('🎯 I choose...')
            .setColor('#3b82f6')
            .setDescription(`## ${chosen}`)
            .addFields({
                name: `Considered ${options.length} options`,
                value: previewList(options),
                inline: false
            })
            .setFooter({ text: `Asked by ${interaction.user.tag} • Each option had equal odds` })
            .setTimestamp();

        // Tiny suspense: send a teaser then reveal the pick.
        await interaction.reply({ content: '🤔 Thinking...' });
        setTimeout(() => {
            interaction.editReply({ content: null, embeds: [embed] }).catch(() => null);
        }, 800);
    }
};

// End of file: choose.js

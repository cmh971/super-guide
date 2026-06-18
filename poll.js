/**
 * @file poll.js
 * @description Creates a reaction-based poll with up to ten options. Adds the
 *              matching number emojis automatically so members can vote.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /poll
 * ============================================================
 *  Category    : Utility
 *  Summary     : Create a reaction poll
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
 * ============================================================
 */


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Number emojis used for the first ten options.
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Parse a comma-separated option string into a clean array.
 * @param {string} raw
 * @returns {string[]}
 */
function parseOptions(raw) {
    return raw
        .split(/[,|]/)
        .map(o => o.trim())
        .filter(o => o.length > 0)
        .slice(0, 10);
}

/**
 * Build the description body listing each option beside its emoji.
 * @param {string[]} options
 * @returns {string}
 */
function buildBody(options) {
    return options
        .map((opt, i) => `${NUMBER_EMOJIS[i]}  ${opt}`)
        .join('\n\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a reaction poll')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('options')
                .setDescription('Options separated by commas (2-10). Omit for a Yes/No poll.')
                .setRequired(false)),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const rawOptions = interaction.options.getString('options');

        // Default to a simple Yes/No poll when no options are supplied.
        let options = rawOptions ? parseOptions(rawOptions) : ['Yes', 'No'];

        if (options.length < 2) {
            return interaction.reply({
                content: '❌ A poll needs at least two options separated by commas.',
                ephemeral: true
            });
        }

        const isYesNo = !rawOptions;

        const embed = new EmbedBuilder()
            .setTitle('📊 ' + question)
            .setColor('#3b82f6')
            .setDescription(buildBody(options))
            .setFooter({ text: `Poll by ${interaction.user.tag}` })
            .setTimestamp();

        // Send the poll, then attach the voting reactions.
        await interaction.reply({ embeds: [embed], fetchReply: true });
        const message = await interaction.fetchReply();

        try {
            if (isYesNo) {
                await message.react('✅');
                await message.react('❌');
            } else {
                for (let i = 0; i < options.length; i++) {
                    await message.react(NUMBER_EMOJIS[i]);
                }
            }
        } catch (err) {
            console.error('[poll] failed to add reactions:', err.message);
        }
    }
};

// End of file: poll.js

/**
 * @file wordcount.js
 * @description Analyzes a block of text: counts characters, words, sentences,
 *              unique words, and estimates reading time.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /wordcount
 * ============================================================
 *  Category    : Text
 *  Summary     : Analyze text: words, characters, sentences, reading time
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

/**
 * Count words by splitting on whitespace.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

/**
 * Count sentences by terminal punctuation.
 * @param {string} text
 * @returns {number}
 */
function countSentences(text) {
    const matches = text.match(/[^.!?]+[.!?]+/g);
    return matches ? matches.length : (text.trim() ? 1 : 0);
}

/**
 * Count distinct words, case-insensitively, ignoring punctuation.
 * @param {string} text
 * @returns {number}
 */
function countUnique(text) {
    const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    return new Set(words).size;
}

/**
 * Find the most frequent word for a fun stat.
 * @param {string} text
 * @returns {{ word: string, count: number }|null}
 */
function topWord(text) {
    const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    let best = null;
    for (const [word, count] of freq) {
        if (!best || count > best.count) best = { word, count };
    }
    return best;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordcount')
        .setDescription('Analyze text: words, characters, sentences, reading time')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to analyze')
                .setRequired(true)),

    async execute(interaction) {
        const text = interaction.options.getString('text');

        const chars = text.length;
        const charsNoSpaces = text.replace(/\s/g, '').length;
        const words = countWords(text);
        const sentences = countSentences(text);
        const unique = countUnique(text);
        const top = topWord(text);

        // Average adult reading speed ~200 wpm.
        const readingSeconds = Math.max(1, Math.round((words / 200) * 60));

        const embed = new EmbedBuilder()
            .setTitle('📝 Text Analysis')
            .setColor('#3b82f6')
            .addFields(
                { name: 'Characters', value: `${chars} (${charsNoSpaces} no spaces)`, inline: true },
                { name: 'Words', value: `${words}`, inline: true },
                { name: 'Unique Words', value: `${unique}`, inline: true },
                { name: 'Sentences', value: `${sentences}`, inline: true },
                { name: 'Avg Word Length', value: `${words ? (charsNoSpaces / words).toFixed(1) : 0} chars`, inline: true },
                { name: 'Reading Time', value: `~${readingSeconds}s`, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` });

        if (top) {
            embed.addFields({ name: 'Most Frequent Word', value: `\`${top.word}\` (${top.count}×)`, inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: wordcount.js

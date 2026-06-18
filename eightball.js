/**
 * @file eightball.js
 * @description A classic Magic 8-Ball. Answers any yes/no question with one of
 *              the traditional twenty responses, grouped by sentiment.
 */

/*
 * ============================================================
 *  COMMAND REFERENCE - /eightball
 * ============================================================
 *  Category    : Fun
 *  Summary     : Ask the Magic 8-Ball a yes/no question
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

// The canonical Magic 8-Ball answers, grouped by tone.
const ANSWERS = {
    affirmative: [
        'It is certain.',
        'It is decidedly so.',
        'Without a doubt.',
        'Yes definitely.',
        'You may rely on it.',
        'As I see it, yes.',
        'Most likely.',
        'Outlook good.',
        'Yes.',
        'Signs point to yes.'
    ],
    neutral: [
        'Reply hazy, try again.',
        'Ask again later.',
        'Better not tell you now.',
        'Cannot predict now.',
        'Concentrate and ask again.'
    ],
    negative: [
        'Don\'t count on it.',
        'My reply is no.',
        'My sources say no.',
        'Outlook not so good.',
        'Very doubtful.'
    ]
};

/**
 * Choose a random answer and report which sentiment bucket it came from.
 * @returns {{ text: string, tone: 'affirmative'|'neutral'|'negative' }}
 */
function pickAnswer() {
    const pool = [];
    for (const tone of Object.keys(ANSWERS)) {
        for (const text of ANSWERS[tone]) {
            pool.push({ text, tone });
        }
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Map a sentiment to an accent color and emoji.
 * @param {string} tone
 * @returns {{ color: number, emoji: string }}
 */
function toneStyle(tone) {
    switch (tone) {
        case 'affirmative': return { color: 0x22c55e, emoji: '✅' };
        case 'negative': return { color: 0xef4444, emoji: '❌' };
        default: return { color: 0xeab308, emoji: '🤔' };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eightball')
        .setDescription('Ask the Magic 8-Ball a yes/no question')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your yes/no question')
                .setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('question');

        // Light validation: encourage actual questions.
        const trimmed = question.trim();
        if (trimmed.length < 3) {
            return interaction.reply({
                content: 'Please ask a real question for the 8-Ball.',
                ephemeral: true
            });
        }

        const { text, tone } = pickAnswer();
        const style = toneStyle(tone);

        const embed = new EmbedBuilder()
            .setTitle('🎱 The Magic 8-Ball')
            .setColor(style.color)
            .addFields(
                { name: '❓ Question', value: trimmed.slice(0, 256), inline: false },
                { name: `${style.emoji} Answer`, value: `*${text}*`, inline: false }
            )
            .setFooter({ text: `Asked by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

// End of file: eightball.js

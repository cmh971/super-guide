const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('define')
        .setDescription('Get the dictionary definition of a word')
        .addStringOption(option => option.setName('word').setDescription('The word to define').setRequired(true)),
    async execute(interaction) {
        const word = interaction.options.getString('word');
        
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const data = await response.json();

            if (data.title === "No Definitions Found") {
                return interaction.reply({ content: `I couldn't find a definition for **${word}**.`, ephemeral: true });
            }

            const entry = data[0];
            const definition = entry.meanings[0].definitions[0].definition;
            const example = entry.meanings[0].definitions[0].example || 'No example available.';

            const embed = new EmbedBuilder()
                .setTitle(`Definition: ${entry.word}`)
                .addFields(
                    { name: 'Part of Speech', value: entry.meanings[0].partOfSpeech, inline: true },
                    { name: 'Phonetic', value: entry.phonetic || 'N/A', inline: true },
                    { name: 'Definition', value: definition },
                    { name: 'Example', value: `*${example}*` }
                )
                .setColor('#3b82f6');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: 'There was an error fetching the definition.', ephemeral: true });
        }
    },
};
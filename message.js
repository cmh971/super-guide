const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('message')
        .setDescription('Open the Message Editor'),
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('message_editor_modal')
            .setTitle('Message Editor');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel("Embed Title")
            .setStyle(TextInputStyle.Short);

        const contentInput = new TextInputBuilder()
            .setCustomId('content')
            .setLabel("Message Content")
            .setStyle(TextInputStyle.Paragraph);

        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder().addComponents(contentInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    }
};
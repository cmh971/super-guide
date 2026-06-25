/**
 * @file staff-app.js
 * @description Staff Application Setup for Kansas State Roleplay.
 * Generates approximately 500 lines of logic when combined with index.js handlers.
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff-app-setup')
        .setDescription('Deploys the Staff Application entry panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Ensure a category exists for review channels
        let category = interaction.guild.channels.cache.find(c => c.name === 'Staff Apps' && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await interaction.guild.channels.create({
                name: 'Staff Apps',
                type: ChannelType.GuildCategory,
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📝 Staff Applications')
            .setDescription(
                'Welcome to the Kansas State Roleplay Staff Application portal.\n\n' +
                '**Requirements:**\n' +
                '• Must be 13+ years of age.\n' +
                '• Must have a clear record.\n' +
                '• Must have a working microphone.\n\n' +
                'Click the button below to start your application. You will be asked **11 questions** across 3 stages.'
            )
            .setColor('#3b82f6')
            .setFooter({ text: '𝓒𝓢𝓡𝓟 Staff Team' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_staff_app')
                .setLabel('Apply Now')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ content: 'Staff application panel deployed.', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [row] });
    },
};
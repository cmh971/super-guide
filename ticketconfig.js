const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const mongoose = require('mongoose');

// Same schema as in index.js (mongoose.models guard prevents re-compilation).
const ticketConfigSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    staffRoleId: String,
    staffRoleId2: String,
    categoryId: String
});
const TicketConfig = mongoose.models.TicketConfig || mongoose.model('TicketConfig', ticketConfigSchema);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketconfig')
        .setDescription('Set the staff role(s) and category used for new tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(o =>
            o.setName('staff_role')
                .setDescription('Primary staff role — gets pinged and the ticket is locked to it')
                .setRequired(true))
        .addChannelOption(o =>
            o.setName('category')
                .setDescription('Category that new tickets open in')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(o =>
            o.setName('staff_role2')
                .setDescription('Optional second staff role that also gets access')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        }

        const primary = interaction.options.getRole('staff_role');
        const second = interaction.options.getRole('staff_role2');
        const category = interaction.options.getChannel('category');

        await TicketConfig.findOneAndUpdate(
            { guildId: interaction.guildId },
            {
                guildId: interaction.guildId,
                staffRoleId: primary.id,
                staffRoleId2: second ? second.id : null,
                categoryId: category.id
            },
            { upsert: true }
        );

        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket configuration saved')
            .setColor('#22c55e')
            .addFields(
                { name: 'Primary staff role (pinged + locked)', value: `${primary}`, inline: false },
                { name: 'Second staff role', value: second ? `${second}` : '*none*', inline: false },
                { name: 'Ticket category', value: `${category.name}`, inline: false }
            )
            .setFooter({ text: 'New tickets will open here and be locked to these roles.' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

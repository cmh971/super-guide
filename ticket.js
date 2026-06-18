const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: String,
    channelId: String,
    openerId: String,
    claimedBy: String,
    status: { type: String, default: 'open' },
    category: String,
    messages: [{
        authorId: String,
        authorTag: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }]
});
const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

const STAFF_ROLE_ID = '1516775846822547465';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket management system')
        .addSubcommand(s => s.setName('claim').setDescription('Claim this ticket'))
        .addSubcommand(s => s.setName('unclaim').setDescription('Unclaim this ticket'))
        .addSubcommand(s => s.setName('add').setDescription('Add a user to the ticket').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove a user from the ticket').addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
        .addSubcommand(s => s.setName('rename').setDescription('Rename the ticket channel').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)))
        .addSubcommand(s => s.setName('close').setDescription('Close the ticket'))
        .addSubcommand(s => s.setName('closerequest').setDescription('Request to close the ticket'))
        .addSubcommand(s => s.setName('manage').setDescription('Manage ticket system (WIP)')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

        if (!ticket && sub !== 'manage') {
            return interaction.reply({ content: '❌ This channel is not an active ticket.', ephemeral: true });
        }

        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID);

        if (sub === 'claim') {
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
            if (ticket.claimedBy) return interaction.reply({ content: `❌ Ticket already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });

            ticket.claimedBy = interaction.user.id;
            await ticket.save();
            
            const embed = new EmbedBuilder()
                .setDescription(`✅ This ticket has been claimed by ${interaction.user}.`)
                .setColor('#22c55e');
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'unclaim') {
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can unclaim tickets.', ephemeral: true });
            ticket.claimedBy = null;
            await ticket.save();
            return interaction.reply('🔓 Ticket unclaimed.');
        }

        if (sub === 'add') {
            const user = interaction.options.getUser('user');
            await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
            return interaction.reply(`➕ Added ${user} to the ticket.`);
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user');
            await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
            return interaction.reply(`➖ Removed ${user} from the ticket.`);
        }

        if (sub === 'rename') {
            const name = interaction.options.getString('name');
            await interaction.channel.setName(name);
            return interaction.reply(`📝 Channel renamed to \`${name}\`.`);
        }

        if (sub === 'close') {
            if (!isStaff) return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
            
            await interaction.reply('💾 Saving transcript and closing channel...');
            
            // Transcript Logic
            const transcript = ticket.messages.map(m => `[${m.timestamp.toISOString()}] ${m.authorTag}: ${m.content}`).join('\n');
            const buffer = Buffer.from(transcript, 'utf-8');
            
            // Send transcript to opener
            const opener = await interaction.client.users.fetch(ticket.openerId).catch(() => null);
            if (opener) {
                await opener.send({ 
                    content: `Your ticket **${interaction.channel.name}** has been closed.`,
                    files: [{ attachment: buffer, name: `transcript-${interaction.channel.name}.txt` }]
                }).catch(() => null);
            }

            ticket.status = 'closed';
            await ticket.save();

            setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
            return;
        }

        if (sub === 'closerequest') {
            const embed = new EmbedBuilder()
                .setTitle('🕒 Close Request')
                .setDescription('A staff member has requested to close this ticket. If you are finished, please use `/ticket close`.')
                .setColor('#f59e0b');
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'manage') {
            return interaction.reply({ content: 'Use `/ticket-setup` to create the support panel.', ephemeral: true });
        }
    }
};
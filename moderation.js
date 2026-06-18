const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Moderation commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(s => s.setName('kick').setDescription('Kick a user').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('ban').setDescription('Ban a user').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason')))
        .addSubcommand(s => s.setName('unban').setDescription('Unban a user ID').addStringOption(o => o.setName('id').setDescription('The user ID').setRequired(true)))
        .addSubcommand(s => s.setName('clear').setDescription('Bulk delete messages').addIntegerOption(o => o.setName('amount').setDescription('1-100').setRequired(true)))
        .addSubcommand(s => s.setName('slowmode').setDescription('Set channel slowmode').addIntegerOption(o => o.setName('seconds').setDescription('Seconds').setRequired(true)))
        .addSubcommand(s => s.setName('lock').setDescription('Lock the current channel'))
        .addSubcommand(s => s.setName('unlock').setDescription('Unlock the current channel'))
        .addSubcommand(s => s.setName('nuke').setDescription('Delete and recreate the channel'))
        .addSubcommand(s => s.setName('warn').setDescription('Warn a user').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
        .addSubcommand(s => s.setName('nickname').setDescription('Change a user nickname').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)).addStringOption(o => o.setName('nick').setDescription('New nickname'))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { guild, channel } = interaction;

        if (sub === 'clear') {
            const amount = interaction.options.getInteger('amount');
            await channel.bulkDelete(Math.min(amount, 100), true);
            return interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
        }

        if (sub === 'kick') {
            const user = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'No reason';
            await guild.members.kick(user, reason);
            return interaction.reply({ content: `Kicked ${user.tag} | ${reason}` });
        }

        if (sub === 'ban') {
            const user = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'No reason';
            await guild.members.ban(user, { reason });
            return interaction.reply({ content: `Banned ${user.tag} | ${reason}` });
        }

        if (sub === 'unban') {
            const id = interaction.options.getString('id');
            await guild.members.unban(id);
            return interaction.reply({ content: `Unbanned user ID: ${id}` });
        }

        if (sub === 'slowmode') {
            const sec = interaction.options.getInteger('seconds');
            await channel.setRateLimitPerUser(sec);
            return interaction.reply({ content: `Slowmode set to ${sec}s.` });
        }

        if (sub === 'lock') {
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
            return interaction.reply({ content: 'Channel locked. 🔒' });
        }

        if (sub === 'unlock') {
            await channel.permissionOverwrites.edit(guild.id, { SendMessages: true });
            return interaction.reply({ content: 'Channel unlocked. 🔓' });
        }

        if (sub === 'nuke') {
            const newChannel = await channel.clone();
            await channel.delete();
            return newChannel.send({ content: 'Channel nuked and recreated! 💥' });
        }

        if (sub === 'warn') {
            const target = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason');
            // Logic for DB warning can go here
            return interaction.reply({ content: `Warned ${target.tag}: ${reason}` });
        }

        if (sub === 'nickname') {
            const target = interaction.options.getMember('target');
            const nick = interaction.options.getString('nick');
            await target.setNickname(nick);
            return interaction.reply({ content: `Nickname changed to: ${nick || 'Reset'}` });
        }
    }
};
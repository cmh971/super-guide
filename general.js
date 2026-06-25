const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Informational commands')
        .addSubcommand(s => s.setName('ping').setDescription('Check latency'))
        .addSubcommand(s => s.setName('server').setDescription('Server details'))
        .addSubcommand(s => s.setName('members').setDescription('Member count'))
        .addSubcommand(s => s.setName('bot').setDescription('Bot details'))
        .addSubcommand(s => s.setName('uptime').setDescription('Bot uptime'))
        .addSubcommand(s => s.setName('help').setDescription('Bot help menu'))
        .addSubcommand(s => s.setName('roles').setDescription('Server roles'))
        .addSubcommand(s => s.setName('invites').setDescription('Server invite links'))
        .addSubcommand(s => s.setName('permissions').setDescription('Your permissions'))
        .addSubcommand(s => s.setName('channel').setDescription('Channel details')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const { guild, client, member } = interaction;

        if (sub === 'ping') {
            return interaction.reply(`🏓 Latency: ${client.ws.ping}ms`);
        }

        if (sub === 'server') {
            const embed = new EmbedBuilder()
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL())
                .addFields(
                    { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Members', value: `${guild.memberCount}`, inline: true }
                ).setColor('#3b82f6');
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'members') {
            return interaction.reply(`Total members: **${guild.memberCount}**`);
        }

        if (sub === 'uptime') {
            const totalSeconds = (client.uptime / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = Math.floor(totalSeconds % 60);
            return interaction.reply(`Online for: **${hours}h ${minutes}m ${seconds}s**`);
        }

        if (sub === 'bot') {
            return interaction.reply(`Running Kansas RP Management Bot on **discord.js v14**.`);
        }

        if (sub === 'help') {
            return interaction.reply('Available modules: `/mod`, `/info`, `/fun`, `/utility`, `/tools`, `/giveaway`, `/chat`');
        }

        if (sub === 'permissions') {
            return interaction.reply({ content: `Your permissions: \`${member.permissions.toArray().join(', ')}\``, ephemeral: true });
        }
        
        if (sub === 'invites') {
            const invites = await guild.invites.fetch();
            return interaction.reply(`Active invites: ${invites.size}`);
        }

        if (sub === 'roles') {
            return interaction.reply(`This server has **${guild.roles.cache.size}** roles.`);
        }

        if (sub === 'channel') {
            return interaction.reply(`Channel Name: **${interaction.channel.name}**\nID: \`${interaction.channel.id}\``);
        }
    }
};
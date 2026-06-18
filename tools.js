const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tool')
        .setDescription('Advanced bot tools')
        .addSubcommand(s => s.setName('poll').setDescription('Create a poll').addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true)))
        .addSubcommand(s => s.setName('remind').setDescription('Set a reminder').addStringOption(o => o.setName('time').setDescription('10m, 1h').setRequired(true)).addStringOption(o => o.setName('msg').setDescription('What to remind').setRequired(true)))
        .addSubcommand(s => s.setName('timer').setDescription('Start a timer').addIntegerOption(o => o.setName('sec').setDescription('Seconds').setRequired(true)))
        .addSubcommand(s => s.setName('announce').setDescription('Send an announcement').addStringOption(o => o.setName('msg').setDescription('Message').setRequired(true)).addChannelOption(o => o.setName('chan').setDescription('Channel')))
        .addSubcommand(s => s.setName('feedback').setDescription('Send feedback').addStringOption(o => o.setName('msg').setDescription('Feedback').setRequired(true)))
        .addSubcommand(s => s.setName('report').setDescription('Report an issue').addStringOption(o => o.setName('msg').setDescription('Issue').setRequired(true)))
        .addSubcommand(s => s.setName('bug').setDescription('Report a bug').addStringOption(o => o.setName('msg').setDescription('Bug').setRequired(true)))
        .addSubcommand(s => s.setName('lyrics').setDescription('Search lyrics').addStringOption(o => o.setName('song').setDescription('Song name').setRequired(true)))
        .addSubcommand(s => s.setName('wiki').setDescription('Search Wikipedia').addStringOption(o => o.setName('query').setDescription('Query').setRequired(true)))
        .addSubcommand(s => s.setName('search').setDescription('Search Google').addStringOption(o => o.setName('query').setDescription('Query').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'poll') {
            const embed = new EmbedBuilder().setTitle('📊 Poll').setDescription(interaction.options.getString('question')).setColor('#3b82f6');
            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
            await msg.react('👍'); await msg.react('👎');
            return;
        }

        if (sub === 'announce') {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({content:'Admin only.', ephemeral:true});
            const chan = interaction.options.getChannel('chan') || interaction.channel;
            const embed = new EmbedBuilder().setTitle('📢 Announcement').setDescription(interaction.options.getString('msg')).setColor('#3b82f6').setTimestamp();
            await chan.send({ embeds: [embed] });
            return interaction.reply({ content: 'Sent.', ephemeral: true });
        }

        if (sub === 'timer') {
            const sec = interaction.options.getInteger('sec');
            await interaction.reply(`Timer set for ${sec}s.`);
            setTimeout(() => interaction.channel.send(`${interaction.user}, timer is up!`), sec * 1000);
            return;
        }

        if (sub === 'feedback' || sub === 'report' || sub === 'bug') {
            return interaction.reply({ content: 'Thanks! Your input has been logged (simulated).', ephemeral: true });
        }

        if (sub === 'remind') {
            return interaction.reply('Reminder system requires a background task worker to process stored reminders.');
        }

        if (sub === 'wiki') {
            const query = encodeURIComponent(interaction.options.getString('query'));
            return interaction.reply(`https://en.wikipedia.org/wiki/${query}`);
        }

        if (sub === 'search') {
            const query = encodeURIComponent(interaction.options.getString('query'));
            return interaction.reply(`https://www.google.com/search?q=${query}`);
        }

        if (sub === 'lyrics') {
            return interaction.reply('Lyrics search requires a Musixmatch or Genius API key.');
        }
    }
};
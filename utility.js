const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('util')
        .setDescription('Utility tools')
        .addSubcommand(s => s.setName('time').setDescription('Current time'))
        .addSubcommand(s => s.setName('color').setDescription('Preview a hex color').addStringOption(o => o.setName('hex').setDescription('#FFFFFF').setRequired(true)))
        .addSubcommand(s => s.setName('math').setDescription('Solve an equation').addStringOption(o => o.setName('exp').setDescription('e.g. 2+2').setRequired(true)))
        .addSubcommand(s => s.setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City name').setRequired(true)))
        .addSubcommand(s => s.setName('binary').setDescription('Convert text to binary').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)))
        .addSubcommand(s => s.setName('base64').setDescription('Convert text to base64').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)))
        .addSubcommand(s => s.setName('password').setDescription('Generate a password').addIntegerOption(o => o.setName('len').setDescription('Length')))
        .addSubcommand(s => s.setName('qr').setDescription('Generate a QR code').addStringOption(o => o.setName('url').setDescription('URL').setRequired(true)))
        .addSubcommand(s => s.setName('shorten').setDescription('Shorten a URL').addStringOption(o => o.setName('url').setDescription('URL').setRequired(true)))
        .addSubcommand(s => s.setName('translate').setDescription('Translate text').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('to').setDescription('Language code (e.g. es, fr)').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'time') {
            return interaction.reply(`The current time is <t:${Math.floor(Date.now() / 1000)}:F>`);
        }

        if (sub === 'color') {
            const hex = interaction.options.getString('hex').replace('#', '');
            const embed = new EmbedBuilder().setTitle(`Color: #${hex}`).setColor(`#${hex}`).setImage(`https://singlecolorimage.com/get/${hex}/200x200`);
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'math') {
            const exp = interaction.options.getString('exp');
            try { return interaction.reply(`Result: **${eval(exp.replace(/[^-()\d/*+.]/g, ''))}**`); } 
            catch { return interaction.reply('Invalid equation.'); }
        }

        if (sub === 'binary') {
            const text = interaction.options.getString('text');
            const bin = text.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
            return interaction.reply(`\`${bin.slice(0, 1900)}\``);
        }

        if (sub === 'base64') {
            return interaction.reply(`Result: \`${Buffer.from(interaction.options.getString('text')).toString('base64')}\``);
        }

        if (sub === 'password') {
            const len = interaction.options.getInteger('len') || 12;
            const pass = Math.random().toString(36).slice(-len);
            return interaction.reply({ content: `Generated Password: ||${pass}||`, ephemeral: true });
        }

        if (sub === 'qr') {
            const url = interaction.options.getString('url');
            return interaction.reply(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`);
        }

        if (sub === 'weather') {
            return interaction.reply(`Weather data for **${interaction.options.getString('city')}** is currently unavailable without an API key.`);
        }

        if (sub === 'shorten') {
            return interaction.reply('URL Shortening requires a Bitly or TinyURL API key.');
        }

        if (sub === 'translate') {
            return interaction.reply('Translation requires a Google or DeepL API key.');
        }
    }
};
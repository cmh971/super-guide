// erlc.js
// Kansas State Roleplay · ERLC API Integration

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

const API_URL = 'https://api.policeroleplay.community/v1';

const erlcConfigSchema = new mongoose.Schema({
    guildId: String,
    enabled: { type: Boolean, default: true }
});
const ERLCConfig = mongoose.models.ERLCConfig || mongoose.model('ERLCConfig', erlcConfigSchema);

async function fetchERLC(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Server-Key': process.env.ERLC_API_KEY }
    });
    if (!response.ok) return null;
    return response.json();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('erlc')
        .setDescription('Use ERLC API integration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('staff').setDescription('View server staff'))
        .addSubcommand(s => s.setName('players').setDescription('List online players'))
        .addSubcommand(s => s.setName('vehicles').setDescription('List spawned vehicles'))
        .addSubcommand(s => s.setName('server').setDescription('Get server information'))
        .addSubcommand(s => s.setName('queue').setDescription('View server queue'))
        .addSubcommand(s => s.setName('joins').setDescription('View join/leave logs'))
        .addSubcommand(s => s.setName('kills').setDescription('View kill logs'))
        .addSubcommand(s => s.setName('logs').setDescription('View command logs'))
        .addSubcommand(s => s.setName('emergencies').setDescription('View emergency calls'))
        .addSubcommand(s => s.setName('locate').setDescription('Locate a player').addStringOption(o => o.setName('player').setDescription('Player name').setRequired(true)))
        .addSubcommand(s => s.setName('execute').setDescription('Execute a server command').addStringOption(o => o.setName('command').setDescription('Command string').setRequired(true)))
        .addSubcommand(s => s.setName('tempban').setDescription('Tempban a player').addStringOption(o => o.setName('player').setDescription('Player name').setRequired(true)).addIntegerOption(o => o.setName('duration').setDescription('In hours').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))),

    async execute(interaction) {
        // Check if the module is disabled via command
        const config = await ERLCConfig.findOne({ guildId: interaction.guildId });
        if (config && !config.enabled) {
            return interaction.reply({ content: '❌ The ERLC module is currently disabled for this server.', ephemeral: true });
        }

        // Check if the key is actually set
        const apiKey = process.env.ERLC_API_KEY;
        if (!apiKey || apiKey === 'YOUR_ERLC_SERVER_KEY') {
            return interaction.reply({ 
                content: '❌ The ERLC API Key is not configured yet. Use `/erlc-setup key` to set it.', 
                ephemeral: true 
            });
        }

        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        if (sub === 'server') {
            const data = await fetchERLC('/server');
            if (!data) return interaction.editReply('❌ Failed to fetch server data. Check API Key.');

            const embed = new EmbedBuilder()
                .setTitle(`🏠 ERLC Server Info • ${data.Name}`)
                .setColor('#3b82f6')
                .addFields(
                    { name: 'Owner', value: data.OwnerName, inline: true },
                    { name: 'Player Count', value: `${data.CurrentPlayers}/${data.MaxPlayers}`, inline: true },
                    { name: 'Status', value: data.Joinable ? '🟢 Joinable' : '🔴 Closed', inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'players') {
            const data = await fetchERLC('/server/players');
            if (!data || !data.length) return interaction.editReply('No players currently online.');

            const list = data.map(p => `**${p.Name}** (${p.Permission})`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle(`👥 Online Players (${data.length})`)
                .setDescription(list.substring(0, 4000))
                .setColor('#3b82f6');
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'vehicles') {
            const data = await fetchERLC('/server/vehicles');
            if (!data || !data.length) return interaction.editReply('No vehicles spawned.');

            const embed = new EmbedBuilder()
                .setTitle(`🚗 Spawned Vehicles (${data.length})`)
                .setDescription(data.map(v => `**${v.Name}** - Owner: ${v.Owner}`).join('\n').substring(0, 4000))
                .setColor('#3b82f6');
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'kills') {
            const data = await fetchERLC('/server/killlogs');
            if (!data || !data.length) return interaction.editReply('No recent kill logs.');

            const embed = new EmbedBuilder()
                .setTitle('⚔️ Kill Logs')
                .setDescription(data.slice(0, 10).map(k => `**${k.Killer}** killed **${k.Victim}**`).join('\n'))
                .setColor('#ef4444');
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'execute') {
            const cmd = interaction.options.getString('command');
            const response = await fetch(`${API_URL}/server/command`, {
                method: 'POST',
                headers: { 'Server-Key': process.env.ERLC_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });

            if (response.ok) {
                return interaction.editReply(`✅ Command \`${cmd}\` executed successfully.`);
            } else {
                return interaction.editReply('❌ Failed to execute command.');
            }
        }

        // Other subcommands (logs, queue, etc.) follow similar patterns using fetchERLC
        return interaction.editReply(`The **${sub}** ERLC module is initialized and ready for expansion.`);
    }
};
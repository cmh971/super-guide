// automations.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');

const autoSchema = new mongoose.Schema({
    guildId: String,
    name: String,
    trigger: String,
    action: String
});
const Auto = mongoose.models.Automation || mongoose.model('Automation', autoSchema);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automations')
        .setDescription('Manage server automations')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('create').setDescription('Create automation').addStringOption(o => o.setName('name').setRequired(true).setDescription('Auto name')).addStringOption(o => o.setName('trigger').setRequired(true).setDescription('Trigger phrase')).addStringOption(o => o.setName('action').setRequired(true).setDescription('Response')))
        .addSubcommand(s => s.setName('list').setDescription('View automations'))
        .addSubcommand(s => s.setName('delete').setDescription('Delete automation').addStringOption(o => o.setName('name').setRequired(true).setDescription('Auto name'))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const trigger = interaction.options.getString('trigger');
            const action = interaction.options.getString('action');

            await Auto.create({ guildId: interaction.guildId, name, trigger, action });
            return interaction.reply({ content: `✅ Automation **${name}** created!`, ephemeral: true });
        }

        if (sub === 'list') {
            const autos = await Auto.find({ guildId: interaction.guildId });
            if (!autos.length) return interaction.reply('No automations found.');

            const embed = new EmbedBuilder()
                .setTitle('🤖 Server Automations')
                .setDescription(autos.map(a => `**${a.name}**: If "${a.trigger}" then say "${a.action}"`).join('\n'))
                .setColor('#3b82f6');
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name');
            await Auto.deleteOne({ guildId: interaction.guildId, name });
            return interaction.reply({ content: `🗑️ Automation **${name}** deleted.`, ephemeral: true });
        }
    }
};
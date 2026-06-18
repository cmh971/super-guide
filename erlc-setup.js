const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

// Schema to track if ERLC is enabled for the server
const erlcConfigSchema = new mongoose.Schema({
    guildId: String,
    enabled: { type: Boolean, default: true }
});
const ERLCConfig = mongoose.models.ERLCConfig || mongoose.model('ERLCConfig', erlcConfigSchema);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('erlc-setup')
        .setDescription('Configure the ERLC API integration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('key')
            .setDescription('Set the ERLC API Key')
            .addStringOption(opt => opt.setName('key').setDescription('Your ERLC Server API Key').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('id')
            .setDescription('Set the ERLC Server ID')
            .addStringOption(opt => opt.setName('id').setDescription('Your ERLC Private Server ID').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('toggle')
            .setDescription('Enable or disable ERLC commands')
            .addBooleanOption(opt => opt.setName('status').setDescription('True to enable, False to disable').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const envPath = path.join(__dirname, '.env');

        if (sub === 'key' || sub === 'id') {
            const value = interaction.options.getString(sub === 'key' ? 'key' : 'id');
            const envKey = sub === 'key' ? 'ERLC_API_KEY' : 'ERLC_SERVER_ID';

            // Read .env and update the specific line
            let envContent = fs.readFileSync(envPath, 'utf8');
            const lines = envContent.split(/\r?\n/);
            let found = false;

            const newLines = lines.map(line => {
                if (line.startsWith(`${envKey}=`)) {
                    found = true;
                    return `${envKey}=${value}`;
                }
                return line;
            });

            if (!found) newLines.push(`${envKey}=${value}`);

            fs.writeFileSync(envPath, newLines.join('\n'));
            
            // Also update it in memory so we don't need a restart
            process.env[envKey] = value;

            return interaction.reply({ 
                content: `✅ Successfully updated **${envKey}** in the configuration.`, 
                ephemeral: true 
            });
        }

        if (sub === 'toggle') {
            const status = interaction.options.getBoolean('status');
            await ERLCConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                { enabled: status },
                { upsert: true }
            );

            return interaction.reply({ 
                content: `✅ ERLC integration has been **${status ? 'enabled' : 'disabled'}**.`, 
                ephemeral: true 
            });
        }
    }
};
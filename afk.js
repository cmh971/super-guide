const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const afkSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    reason: String,
    timestamp: Date
});

const AFK = mongoose.models.AFK || mongoose.model('AFK', afkSchema);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status')
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Why are you going away?')),
    
    async execute(interaction) {
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        await AFK.findOneAndUpdate(
            { userId: interaction.user.id, guildId: interaction.guildId },
            { reason, timestamp: new Date() },
            { upsert: true }
        );

        return interaction.reply({ 
            content: `I have set your AFK: **${reason}**`, 
            ephemeral: true 
        });
    },

    // Helper called by index.js
    async checkAndClearAfk(message) {
        const data = await AFK.findOneAndDelete({ userId: message.author.id, guildId: message.guildId });
        if (data) {
            const msg = await message.reply(`Welcome back <@${message.author.id}>! I've removed your AFK.`);
            setTimeout(() => msg.delete().catch(() => null), 5000);
        }
    },

    async checkMentions(message) {
        for (const [userId, user] of message.mentions.users) {
            const data = await AFK.findOne({ userId, guildId: message.guildId });
            if (data) {
                const ts = Math.floor(data.timestamp.getTime() / 1000);
                message.reply(`${user.username} is AFK: **${data.reason}** (<t:${ts}:R>)`);
            }
        }
    }
};
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const mongoose = require('mongoose');

// --- Configuration & Models ---
const STAFF_ROLE_ID = '1516775846822547465';
const LOG_CHANNEL_ID = '1516775848194347193';

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

const appSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    status: { type: String, default: 'pending' },
    answers: { type: Map, of: String },
    channelId: String,
    step: { type: Number, default: 1 }
});
const StaffApp = mongoose.models.StaffApp || mongoose.model('StaffApp', appSchema);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // needed to receive the verification captcha reply in DMs
    ],
    partials: [Partials.Channel] // DM channels arrive as partials; without this, DM messages are dropped
});
client.commands = new Collection();

// --- Command Loader (Moved to Top) ---
const commandFiles = fs.readdirSync(__dirname).filter(file => 
    file.endsWith('.js') && 
    file !== 'index.js' && 
    file !== 'deploy-commands.js'
);

for (const file of commandFiles) {
    const filePath = path.join(__dirname, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// --- Global Interaction Handler ---
client.on(Events.InteractionCreate, async interaction => {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const replyOptions = { content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] };
            if (interaction.replied || interaction.deferred) await interaction.followUp(replyOptions);
            else await interaction.reply(replyOptions);
        }
        return;
    }

    // Verification button (must run before the staff-only button gate below)
    if (interaction.isButton() && interaction.customId === 'verify_start') {
        const verifyCmd = client.commands.get('verify');
        if (verifyCmd?.handleVerifyButton) return verifyCmd.handleVerifyButton(interaction);
        return;
    }

    // 2. Ticket Creation (Select Menu)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const category = interaction.values[0];
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        let parent = interaction.guild.channels.cache.find(c => c.name === 'Support Tickets' && c.type === ChannelType.GuildCategory);
        if (!parent) {
            parent = await interaction.guild.channels.create({
                name: 'Support Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
        }

        const channel = await interaction.guild.channels.create({
            name: `${category.toLowerCase()}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: parent.id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        await Ticket.create({
            guildId: interaction.guildId,
            channelId: channel.id,
            openerId: interaction.user.id,
            category: category
        });

        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket')
            .setDescription(`Welcome ${interaction.user}! Staff will be with you shortly.\n**Category:** ${category}`)
            .setColor('#3b82f6')
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`, embeds: [embed], components: [buttons] });
        return interaction.editReply(`Ticket created: ${channel}`);
    }

    // 2. Handling Buttons (Claim/Close)
    if (interaction.isButton()) {
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: '❌ Only staff can use these buttons.', flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'claim_ticket') {
            const ticket = await Ticket.findOne({ channelId: interaction.channelId });
            if (ticket && !ticket.claimedBy) {
                ticket.claimedBy = interaction.user.id;
                await ticket.save();
                await interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}.` });
                const newButtons = ActionRowBuilder.from(interaction.message.components[0]);
                newButtons.components[0].setDisabled(true);
                await interaction.message.edit({ components: [newButtons] });
            }
        } else if (interaction.customId === 'close_ticket') {
            const ticket = await Ticket.findOne({ channelId: interaction.channelId });
            if (ticket) {
                const chan = interaction.channel;
                await interaction.reply('💾 Saving transcript and closing...');
                const transcript = ticket.messages.map(m => `[${m.timestamp.toISOString()}] ${m.authorTag}: ${m.content}`).join('\n');
                const opener = await client.users.fetch(ticket.openerId).catch(() => null);
                if (opener) await opener.send({ content: 'Ticket closed.', files: [{ attachment: Buffer.from(transcript), name: 'transcript.txt' }] }).catch(() => null);
                setTimeout(() => chan?.delete().catch(() => null), 3000);
            }
        }
    }

    // --- Staff App Interaction Logic ---
    if (interaction.isButton() && interaction.customId === 'start_staff_app') {
        const modal = new ModalBuilder().setCustomId('staff_app_1').setTitle('Staff Application - Part 1');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('Real Name & Age').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('Timezone').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('Why do you want to join?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('Previous Staff Experience?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5').setLabel('Weekly dedication (Hours)').setStyle(TextInputStyle.Short).setRequired(true))
        );
        return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'staff_app_1') {
            const answers = { 
                q1: interaction.fields.getTextInputValue('q1'), 
                q2: interaction.fields.getTextInputValue('q2'),
                q3: interaction.fields.getTextInputValue('q3'),
                q4: interaction.fields.getTextInputValue('q4'),
                q5: interaction.fields.getTextInputValue('q5')
            };
            await StaffApp.findOneAndUpdate({ userId: interaction.user.id }, { answers, step: 2 }, { upsert: true });
            const nextBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('staff_app_step_2').setLabel('Continue to Part 2').setStyle(ButtonStyle.Primary));
            return await interaction.reply({ content: 'Part 1 saved! Click below for the next set of questions.', components: [nextBtn], flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'staff_app_2') {
            const app = await StaffApp.findOne({ userId: interaction.user.id });
            const newAnswers = {
                q6: interaction.fields.getTextInputValue('q6'),
                q7: interaction.fields.getTextInputValue('q7'),
                q8: interaction.fields.getTextInputValue('q8'),
                q9: interaction.fields.getTextInputValue('q9'),
                q10: interaction.fields.getTextInputValue('q10')
            };
            app.answers = { ...Object.fromEntries(app.answers), ...newAnswers };
            app.step = 3;
            await app.save();
            const nextBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('staff_app_step_3').setLabel('Continue to Final Question').setStyle(ButtonStyle.Primary));
            return await interaction.reply({ content: 'Part 2 saved! Almost done.', components: [nextBtn], flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'staff_app_3') {
            const app = await StaffApp.findOne({ userId: interaction.user.id });
            app.answers.set('q11', interaction.fields.getTextInputValue('q11'));
            app.status = 'submitted';
            
            // Create Review Channel
            const channel = await interaction.guild.channels.create({
                name: `app-${interaction.user.username}`,
                parent: interaction.guild.channels.cache.find(c => c.name === 'Staff Apps' && c.type === ChannelType.GuildCategory)?.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            
            app.channelId = channel.id;
            await app.save();

            const reviewEmbed = new EmbedBuilder().setTitle(`New Staff Application: ${interaction.user.tag}`).setColor('#3b82f6').setTimestamp();
            app.answers.forEach((val, key) => reviewEmbed.addFields({ name: `Question ${key.replace('q','')}`, value: val }));
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`app_approve_${interaction.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`app_deny_${interaction.user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [reviewEmbed], components: [row] });
            return await interaction.reply({ content: 'Application submitted! Staff will review it shortly.', flags: [MessageFlags.Ephemeral] });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'staff_app_step_2') {
            const modal = new ModalBuilder().setCustomId('staff_app_2').setTitle('Staff Application - Part 2');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q6').setLabel('Scenario: User breaking rules?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q7').setLabel('Scenario: Staff member abusing?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q8').setLabel('What makes you unique?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q9').setLabel('Do you have a working mic?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q10').setLabel('Are you in the main server?').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }
        if (interaction.customId === 'staff_app_step_3') {
            const modal = new ModalBuilder().setCustomId('staff_app_3').setTitle('Staff Application - Final');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q11').setLabel('Agree to terms & conditions?').setStyle(TextInputStyle.Short).setRequired(true)));
            return await interaction.showModal(modal);
        }

        // Approve / Deny Logic
        if (interaction.customId.startsWith('app_approve_') || interaction.customId.startsWith('app_deny_')) {
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) return interaction.reply({ content: 'Unauthorized.', flags: [MessageFlags.Ephemeral] });
            
            const targetId = interaction.customId.split('_')[2];
            const status = interaction.customId.includes('approve') ? 'Approved' : 'Denied';
            const targetUser = await client.users.fetch(targetId);
            
            const logEmbed = new EmbedBuilder()
                .setTitle(`Application ${status}`)
                .addFields({ name: 'Applicant', value: `${targetUser}`, inline: true }, { name: 'Staff', value: `${interaction.user}`, inline: true })
                .setColor(status === 'Approved' ? '#22c55e' : '#ef4444').setTimestamp();

            const logChan = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChan) logChan.send({ embeds: [logEmbed] });

            if (status === 'Approved') {
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member) member.roles.add(STAFF_ROLE_ID).catch(() => null);
            }

            await targetUser.send(`Your staff application for **${interaction.guild.name}** has been **${status}**.`).catch(() => null);
            
            const chan = interaction.channel;
            await interaction.reply(`Application ${status}. Closing channel...`);
            setTimeout(() => chan?.delete().catch(() => null), 5000);
        }
    }


    // 3. Modals
    if (interaction.isModalSubmit() && interaction.customId === 'message_editor_modal') {
        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');
        const embed = new EmbedBuilder().setTitle(title).setDescription(content).setColor('#3b82f6');
        await interaction.channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Message sent!', flags: [MessageFlags.Ephemeral] });
    }
});

// --- Global Message Handler ---
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Verification captcha replies come in via DM (no guild).
    if (!message.guild) {
        const verifyCmd = client.commands.get('verify');
        if (verifyCmd?.handleVerifyDM) await verifyCmd.handleVerifyDM(message, client);
        return;
    }

    // 1. Ticket Transcripts
    const ticket = await Ticket.findOne({ channelId: message.channelId });
    if (ticket) {
        ticket.messages.push({ authorId: message.author.id, authorTag: message.author.tag, content: message.content });
        await ticket.save();
    }

    // 2. AFK Logic
    const afkCommand = client.commands.get('afk');
    if (afkCommand) {
        if (afkCommand.checkAndClearAfk) await afkCommand.checkAndClearAfk(message);
        if (message.mentions.users.size > 0 && afkCommand.checkMentions) await afkCommand.checkMentions(message);
    }
});

// --- Auto-verify bots (they can't click buttons / spell captchas) ---
client.on(Events.GuildMemberAdd, async member => {
    const verifyCmd = client.commands.get('verify');
    if (verifyCmd?.autoVerifyBot) await verifyCmd.autoVerifyBot(member);
});

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    if (process.env.MONGO_URI) {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const giveawayCmd = client.commands.get('giveaway');
        if (giveawayCmd?.restoreActiveGiveaways) {
            await giveawayCmd.restoreActiveGiveaways(client);
            console.log('Restored active giveaways.');
        }

        // Staff dashboard bridge: DM server-picker + dashboard command executor.
        // Lives under /dashboard so the command loader above never touches it.
        try {
            require('./dashboard/src/bot-integration').init(client);
        } catch (err) {
            console.error('Failed to start dashboard bridge:', err.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
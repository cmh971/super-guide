'use strict';

/**
 * Bot-side half of the dashboard bridge.
 *
 * Required and started from the bot's index.js (`require('./dashboard/src/bot-integration').init(client)`).
 * It lives under /dashboard so the bot's root command-loader never picks it up.
 *
 * Responsibilities:
 *   - DM staff members the "choose your server" buttons after they log in.
 *   - Handle those button clicks and record the chosen guild.
 *   - Poll the CommandJob queue and execute whitelisted commands in the chosen guild.
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, PermissionFlagsBits,
} = require('discord.js');

const config = require('./config');
const { ServerSelection, CommandJob, audit } = require('./db');

const POLL_MS = 3000;
const BRAND = 0x5865f2;

/** Send the server-picker DM to a user and remember the message id. */
async function sendPickerDM(client, selection) {
  const user = await client.users.fetch(selection.userId).catch(() => null);
  if (!user) return;

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('🔐 Staff Dashboard — Choose a Server')
    .setDescription(
      `Hey **${selection.username}**! You just logged in to the staff dashboard.\n\n` +
      'Pick which server you want to manage. Everything you do on the dashboard ' +
      'will be sent to the server you choose here.',
    )
    .setFooter({ text: 'You can switch servers any time from the dashboard.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    ...config.servers
      .filter((s) => s.id)
      .map((s, i) =>
        new ButtonBuilder()
          .setCustomId(`dash_pick_${s.id}`)
          .setLabel(s.name)
          .setStyle(i === 0 ? ButtonStyle.Primary : ButtonStyle.Success)
          .setEmoji(i === 0 ? '🟦' : '🟪'),
      ),
  );

  try {
    const dm = await user.send({ embeds: [embed], components: [row] });
    selection.dmMessageId = dm.id;
    await selection.save();
  } catch {
    console.warn(`[bridge] could not DM ${selection.userId} (DMs closed?)`);
  }
}

/** Watch for new "awaiting" selections that haven't been DM'd yet. */
async function pollSelections(client) {
  const pending = await ServerSelection.find({ status: 'awaiting', dmMessageId: null }).limit(10);
  for (const sel of pending) {
    await sendPickerDM(client, sel);
  }
}

/** Handle a click on one of the server-picker buttons. */
async function handlePickButton(interaction) {
  const guildId = interaction.customId.slice('dash_pick_'.length);
  const server = config.servers.find((s) => s.id === guildId);
  if (!server) {
    return interaction.reply({ content: '❌ Unknown server.', ephemeral: true });
  }

  await ServerSelection.findOneAndUpdate(
    { userId: interaction.user.id },
    { status: 'selected', guildId: server.id, guildName: server.name },
  );

  await audit({
    userId: interaction.user.id,
    username: interaction.user.username,
    action: 'select-server',
    guildId: server.id,
    detail: `Selected ${server.name} via DM`,
  });

  const done = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('✅ Server Selected')
    .setDescription(`You're now managing **${server.name}**.\nHead back to the dashboard — it has unlocked.`);

  await interaction.update({ embeds: [done], components: [] }).catch(() => null);
}

// ---- Command execution -----------------------------------------------------

/** Map of dashboard command -> async handler(guild, member, args) => string result. */
const handlers = {
  async ping(guild) {
    return `🏓 Pong! Bot is online in **${guild.name}** (WS ping ${Math.round(guild.client.ws.ping)}ms).`;
  },

  async membercount(guild) {
    const total = guild.memberCount;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    return `👥 **${guild.name}** has **${total}** members (${bots} known bots cached).`;
  },

  async serverinfo(guild) {
    const owner = await guild.fetchOwner().catch(() => null);
    return [
      `📊 **${guild.name}**`,
      `ID: ${guild.id}`,
      `Owner: ${owner ? owner.user.tag : 'unknown'}`,
      `Members: ${guild.memberCount}`,
      `Channels: ${guild.channels.cache.size}`,
      `Roles: ${guild.roles.cache.size}`,
      `Created: ${guild.createdAt.toISOString().slice(0, 10)}`,
    ].join('\n');
  },

  async announce(guild, member, args) {
    const channel = await resolveTextChannel(guild, args.channelId);
    const embed = new EmbedBuilder()
      .setColor(BRAND)
      .setTitle(args.title || '📢 Announcement')
      .setDescription(args.message || '(no message)')
      .setFooter({ text: `Posted via dashboard by ${member.user.tag}` })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
    return `✅ Announcement posted in #${channel.name}.`;
  },

  async embedmaker(guild, member, args) {
    const channel = await resolveTextChannel(guild, args.channelId);
    const embed = new EmbedBuilder()
      .setColor(args.color || BRAND)
      .setTitle(args.title || 'Embed')
      .setDescription(args.description || '');
    await channel.send({ embeds: [embed] });
    return `✅ Embed sent to #${channel.name}.`;
  },

  async poll(guild, member, args) {
    const channel = await resolveTextChannel(guild, args.channelId);
    const options = (args.options || '').split('|').map((o) => o.trim()).filter(Boolean).slice(0, 10);
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = options.length
      ? options.map((o, i) => `${emojis[i]} ${o}`).join('\n')
      : '👍 Yes\n👎 No';
    const embed = new EmbedBuilder().setColor(BRAND).setTitle(`📊 ${args.question || 'Poll'}`).setDescription(desc);
    const msg = await channel.send({ embeds: [embed] });
    if (options.length) {
      for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
    } else {
      await msg.react('👍'); await msg.react('👎');
    }
    return `✅ Poll posted in #${channel.name}.`;
  },

  async giveaway(guild, member, args) {
    const channel = await resolveTextChannel(guild, args.channelId);
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`**Prize:** ${args.prize || 'Mystery prize'}\nReact with 🎉 to enter!`)
      .setFooter({ text: `Hosted by ${member.user.tag}` })
      .setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    await msg.react('🎉');
    return `✅ Giveaway started in #${channel.name}.`;
  },
};

async function resolveTextChannel(guild, channelId) {
  if (!channelId) throw new Error('channelId is required for this command');
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not a text channel');
  return channel;
}

/** Execute a single queued job. */
async function executeJob(client, job) {
  job.status = 'running';
  await job.save();

  try {
    const guild = await client.guilds.fetch(job.guildId).catch(() => null);
    if (!guild) throw new Error('Bot is not in that server');

    const member = await guild.members.fetch(job.userId).catch(() => null);
    if (!member) throw new Error('You are not a member of that server');
    if (!member.roles.cache.has(config.staffRoleId)) {
      throw new Error('You do not have the staff role in that server');
    }

    const handler = handlers[job.command];
    if (!handler) throw new Error(`No handler for command "${job.command}"`);

    const args = job.args ? Object.fromEntries(job.args) : {};
    const result = await handler(guild, member, args);

    job.status = 'done';
    job.result = result;
    job.finishedAt = new Date();
    await job.save();
  } catch (err) {
    job.status = 'error';
    job.error = err.message || String(err);
    job.finishedAt = new Date();
    await job.save();
  }
}

/** Poll the queue for pending jobs. */
async function pollJobs(client) {
  const jobs = await CommandJob.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(5);
  for (const job of jobs) {
    await executeJob(client, job);
  }
}

let started = false;

function init(client) {
  if (started) return;
  started = true;

  // Listen for picker-button clicks (a separate listener, so we don't touch
  // the big interaction handler in index.js).
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith('dash_pick_')) {
      try {
        await handlePickButton(interaction);
      } catch (err) {
        console.error('[bridge] pick button error:', err);
      }
    }
  });

  const loop = async () => {
    try {
      await pollSelections(client);
      await pollJobs(client);
    } catch (err) {
      console.error('[bridge] poll error:', err.message);
    }
  };

  setInterval(loop, POLL_MS);
  console.log('[bridge] dashboard bridge active (polling every ' + POLL_MS + 'ms)');
}

module.exports = { init };

'use strict';

const express = require('express');
const config = require('../config');
const { audit, ServerSelection, CommandJob, AuditLog, UserPrefs } = require('../db');
const { requireAuth, requireServer } = require('../middleware');

const router = express.Router();

// The toggle/theme fields a client is allowed to set, with validators.
const PREF_FIELDS = {
  theme: (v) => (['aurora', 'midnight'].includes(v) ? v : undefined),
  desktopNotifications: (v) => (typeof v === 'boolean' ? v : undefined),
  compactConsole: (v) => (typeof v === 'boolean' ? v : undefined),
  autoRefreshActivity: (v) => (typeof v === 'boolean' ? v : undefined),
  confirmBeforeRun: (v) => (typeof v === 'boolean' ? v : undefined),
};

function prefsToJson(doc) {
  return {
    theme: doc?.theme ?? 'aurora',
    desktopNotifications: doc?.desktopNotifications ?? false,
    compactConsole: doc?.compactConsole ?? false,
    autoRefreshActivity: doc?.autoRefreshActivity ?? true,
    confirmBeforeRun: doc?.confirmBeforeRun ?? true,
  };
}

/** Who am I + config the frontend needs. */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: req.session.user,
    selectedGuildId: req.session.selectedGuildId || null,
    servers: config.servers,
    allowedCommands: config.allowedCommands,
  });
});

/**
 * Polled by the "waiting for you to pick a server" page.
 * The BOT updates the ServerSelection record when the user clicks a DM button;
 * here we read that and promote it into the session.
 */
router.get('/selection-status', requireAuth, async (req, res) => {
  const sel = await ServerSelection.findOne({ userId: req.session.user.id });
  if (!sel) return res.json({ status: 'awaiting' });

  if (sel.status === 'selected' && sel.guildId) {
    req.session.selectedGuildId = sel.guildId;
    req.session.selectedGuildName = sel.guildName;
    return res.json({ status: 'selected', guildId: sel.guildId, guildName: sel.guildName });
  }
  return res.json({ status: 'awaiting' });
});

/** Re-trigger the DM (e.g. the user dismissed it). Resets to 'awaiting'. */
router.post('/resend-dm', requireAuth, async (req, res) => {
  await ServerSelection.findOneAndUpdate(
    { userId: req.session.user.id },
    { status: 'awaiting', guildId: null, guildName: null },
    { upsert: true },
  );
  res.json({ ok: true });
});

/** Switch back to the selection screen for the current user. */
router.post('/switch-server', requireAuth, async (req, res) => {
  req.session.selectedGuildId = null;
  await ServerSelection.findOneAndUpdate(
    { userId: req.session.user.id },
    { status: 'awaiting', guildId: null, guildName: null },
  );
  res.json({ ok: true });
});

/** Enqueue a command for the bot to run in the chosen guild. */
router.post('/command', requireAuth, requireServer, async (req, res) => {
  const { command, args } = req.body || {};

  if (!config.allowedCommands.includes(command)) {
    return res.status(400).json({ error: 'command_not_allowed' });
  }

  const job = await CommandJob.create({
    userId: req.session.user.id,
    username: req.session.user.username,
    guildId: req.session.selectedGuildId,
    guildName: req.session.selectedGuildName,
    command,
    args: args && typeof args === 'object' ? args : {},
    status: 'pending',
  });

  await audit({
    userId: req.session.user.id,
    username: req.session.user.username,
    action: 'run-command',
    guildId: req.session.selectedGuildId,
    detail: `${command} ${JSON.stringify(args || {})}`,
    ip: req.ip,
  });

  res.json({ ok: true, jobId: job._id });
});

/** Poll a single job's status/result. */
router.get('/command/:id', requireAuth, async (req, res) => {
  const job = await CommandJob.findById(req.params.id).lean();
  if (!job || job.userId !== req.session.user.id) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({
    id: job._id,
    command: job.command,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  });
});

/** Recent command history for the current user + guild. */
router.get('/history', requireAuth, requireServer, async (req, res) => {
  const jobs = await CommandJob.find({
    userId: req.session.user.id,
    guildId: req.session.selectedGuildId,
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();
  res.json(jobs);
});

/** Recent audit log (everyone). Handy for the activity feed. */
router.get('/audit', requireAuth, async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(logs);
});

/** Get the current user's saved preferences. */
router.get('/prefs', requireAuth, async (req, res) => {
  const doc = await UserPrefs.findOne({ userId: req.session.user.id }).lean();
  res.json(prefsToJson(doc));
});

/** Save (partial) preferences for the current user. */
router.post('/prefs', requireAuth, async (req, res) => {
  const update = {};
  for (const [key, validate] of Object.entries(PREF_FIELDS)) {
    if (key in (req.body || {})) {
      const clean = validate(req.body[key]);
      if (clean === undefined) return res.status(400).json({ error: `invalid_${key}` });
      update[key] = clean;
    }
  }
  update.updatedAt = new Date();
  const doc = await UserPrefs.findOneAndUpdate(
    { userId: req.session.user.id },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  res.json(prefsToJson(doc));
});

/** Live stats for the overview rings. */
router.get('/stats', requireAuth, requireServer, async (req, res) => {
  const guildId = req.session.selectedGuildId;
  const userId = req.session.user.id;

  const [myRuns, auditCount] = await Promise.all([
    CommandJob.countDocuments({ userId, guildId }),
    AuditLog.countDocuments({}),
  ]);

  // Categories the dashboard exposes (mirrors the catalog grouping).
  const categories = new Set();
  for (const cmd of config.allowedCommands) categories.add(categoryFor(cmd));

  res.json({
    uptimeSec: Math.floor(process.uptime()),
    myRuns,
    auditCount,
    categories: categories.size,
    availableCommands: config.allowedCommands.length,
  });
});

// Lightweight category bucketing, kept in sync with the catalog generator.
function categoryFor(name) {
  const map = {
    moderation: ['ban', 'kick', 'mute', 'warn', 'moderation', 'purge', 'timeout'],
    tickets: ['ticket'],
    fun: ['fun', '8ball', 'eightball', 'coinflip', 'roll', 'rps', 'slots', 'lottery', 'ship', 'rate', 'roast', 'joke', 'dadjoke', 'meme', 'trivia', 'truthordare', 'wouldyourather', 'fortune', 'fact', 'compliment', 'motivate', 'scramble'],
    text: ['base64', 'binary', 'caesar', 'morse', 'leet', 'emojify', 'mocktext', 'reversetext', 'vaporwave', 'hashtext', 'wordcount', 'uuid', 'qr', 'passgen'],
    info: ['serverinfo', 'userinfo', 'whois', 'roleinfo', 'channelinfo', 'avatar', 'banner', 'membercount', 'colorinfo', 'define'],
    utility: ['ping', 'calc', 'poll', 'timestamp', 'countdown', 'choose', 'announce', 'embedmaker', 'giveaway', 'afk', 'chat', 'advice', 'quote'],
  };
  for (const [cat, keys] of Object.entries(map)) {
    if (keys.some((k) => name.includes(k))) return cat;
  }
  return 'utility';
}

module.exports = router;

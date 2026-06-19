'use strict';

/**
 * Shared Mongoose models used by BOTH the dashboard and the bot.
 * The two processes communicate purely through these collections:
 *
 *   ServerSelection  - which guild a staff member has chosen (set via DM buttons)
 *   CommandJob       - a queue: dashboard enqueues, bot executes, bot writes result
 *   AuditLog         - immutable record of everything that happened
 *
 * Using the DB as the bridge means the dashboard and the bot can run as
 * separate processes (or even on separate machines) and stay in sync.
 */

const mongoose = require('mongoose');

const serverSelectionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: String,
  avatar: String,
  // 'awaiting' = DM sent, waiting for the user to click a server button.
  // 'selected' = user picked a guild and may now use the dashboard.
  status: { type: String, enum: ['awaiting', 'selected'], default: 'awaiting' },
  guildId: { type: String, default: null },
  guildName: { type: String, default: null },
  dmMessageId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { minimize: false });

serverSelectionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const commandJobSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: String,
  guildId: { type: String, required: true },
  guildName: String,
  command: { type: String, required: true },
  args: { type: Map, of: String, default: {} },
  // pending -> running -> done | error
  status: { type: String, enum: ['pending', 'running', 'done', 'error'], default: 'pending', index: true },
  result: { type: String, default: null },
  error: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: null },
});

const auditLogSchema = new mongoose.Schema({
  userId: String,
  username: String,
  action: String,        // e.g. 'login', 'select-server', 'run-command'
  guildId: String,
  detail: String,
  ip: String,
  createdAt: { type: Date, default: Date.now, index: true },
});

// Per-user dashboard preferences (theme + toggles). Persisted so a staff
// member's settings follow them across sessions and devices.
const userPrefsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  theme: { type: String, enum: ['aurora', 'midnight'], default: 'aurora' },
  desktopNotifications: { type: Boolean, default: false },
  compactConsole: { type: Boolean, default: false },
  autoRefreshActivity: { type: Boolean, default: true },
  confirmBeforeRun: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

const ServerSelection = mongoose.models.ServerSelection
  || mongoose.model('ServerSelection', serverSelectionSchema);
const CommandJob = mongoose.models.CommandJob
  || mongoose.model('CommandJob', commandJobSchema);
const AuditLog = mongoose.models.AuditLog
  || mongoose.model('AuditLog', auditLogSchema);
const UserPrefs = mongoose.models.UserPrefs
  || mongoose.model('UserPrefs', userPrefsSchema);

async function connect(uri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function audit(entry) {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('[audit] failed to write audit entry:', err.message);
  }
}

module.exports = { mongoose, connect, audit, ServerSelection, CommandJob, AuditLog, UserPrefs };

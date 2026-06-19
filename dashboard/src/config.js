'use strict';

/**
 * Central configuration. Everything is read from the project root .env
 * (the dashboard shares the same .env as the bot so there's one source of truth).
 */

const path = require('node:path');

// Load the root .env (one directory above /dashboard).
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    console.warn(`[config] WARNING: env var ${name} is not set. Some features will not work until you set it in .env`);
    return '';
  }
  return v;
}

// The two servers staff can choose between. Pulled from .env, with friendly labels.
const SERVERS = [
  {
    id: required('GUILD_ONE_ID', ''),
    name: required('GUILD_ONE_NAME', 'Server One'),
    color: '#5865F2',
  },
  {
    id: required('GUILD_TWO_ID', ''),
    name: required('GUILD_TWO_NAME', 'Server Two'),
    color: '#EB459E',
  },
];

const config = {
  port: parseInt(required('DASHBOARD_PORT', '3000'), 10),

  // Public base URL of the dashboard. Used to build the OAuth redirect URI.
  baseUrl: required('DASHBOARD_URL', 'http://localhost:3000').replace(/\/+$/, ''),

  // Discord OAuth2 application credentials.
  discord: {
    clientId: required('CLIENT_ID'),
    clientSecret: required('DISCORD_CLIENT_SECRET'),
    get redirectUri() {
      return `${config.baseUrl}/auth/callback`;
    },
    scopes: ['identify', 'guilds'],
    apiBase: 'https://discord.com/api/v10',
  },

  // Session signing secret. Generate a strong one with the C++ helper (see README).
  sessionSecret: required('DASHBOARD_SESSION_SECRET', 'change-me-please-use-a-real-secret'),

  mongoUri: required('MONGO_URI'),

  servers: SERVERS,

  // Only members holding this role in the chosen guild may run commands.
  staffRoleId: required('STAFF_ROLE_ID', '1516775846822547465'),

  // Commands the dashboard is allowed to dispatch. Keep this tight on purpose:
  // the dashboard should never be able to ask the bot to do something arbitrary.
  allowedCommands: [
    'announce',
    'embedmaker',
    'membercount',
    'serverinfo',
    'poll',
    'giveaway',
    'ping',
  ],

  isConfigured() {
    return Boolean(this.discord.clientId && this.discord.clientSecret && this.mongoUri);
  },
};

module.exports = config;

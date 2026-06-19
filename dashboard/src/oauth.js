'use strict';

/**
 * Minimal, dependency-free Discord OAuth2 helper (Authorization Code grant).
 * Node 18+ ships a global `fetch`, so no http client library is needed.
 */

const crypto = require('node:crypto');
const config = require('./config');

/** Build the URL we redirect the user to in order to log in with Discord. */
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: config.discord.scopes.join(' '),
    state,
    prompt: 'consent',
  });
  return `${config.discord.apiBase}/oauth2/authorize?${params.toString()}`;
}

/** Random anti-CSRF state token stored in the session. */
function makeState() {
  return crypto.randomBytes(24).toString('hex');
}

/** Exchange the ?code=... from the callback for an access token. */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discord.redirectUri,
  });

  const res = await fetch(`${config.discord.apiBase}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Fetch the logged-in user's profile using their access token. */
async function fetchUser(accessToken) {
  const res = await fetch(`${config.discord.apiBase}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`failed to fetch user (${res.status})`);
  return res.json();
}

/** Fetch the guilds the user is a member of (used to verify access). */
async function fetchUserGuilds(accessToken) {
  const res = await fetch(`${config.discord.apiBase}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`failed to fetch guilds (${res.status})`);
  return res.json();
}

/** CDN URL for a user's avatar (falls back to the default embed avatar). */
function avatarUrl(user) {
  if (!user.avatar) {
    const idx = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
}

module.exports = { buildAuthUrl, makeState, exchangeCode, fetchUser, fetchUserGuilds, avatarUrl };

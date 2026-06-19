'use strict';

const express = require('express');
const oauth = require('../oauth');
const config = require('../config');
const { audit, ServerSelection } = require('../db');

const router = express.Router();

/** Step 1: kick off the OAuth flow. */
router.get('/login', (req, res) => {
  if (!config.isConfigured()) {
    return res
      .status(503)
      .send('Dashboard is not configured yet. Set CLIENT_ID, DISCORD_CLIENT_SECRET and MONGO_URI in .env.');
  }
  const state = oauth.makeState();
  req.session.oauthState = state;
  res.redirect(oauth.buildAuthUrl(state));
});

/** Step 2: Discord redirects back here with ?code & ?state. */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state. Please try logging in again.');
  }
  delete req.session.oauthState;

  try {
    const token = await oauth.exchangeCode(code);
    const user = await oauth.fetchUser(token.access_token);

    req.session.user = {
      id: user.id,
      username: user.global_name || user.username,
      avatar: oauth.avatarUrl(user),
    };
    req.session.selectedGuildId = null;

    // Create / reset the server-selection record. This is the signal the BOT
    // watches for — it will DM the user asking which server they want.
    await ServerSelection.findOneAndUpdate(
      { userId: user.id },
      {
        userId: user.id,
        username: req.session.user.username,
        avatar: req.session.user.avatar,
        status: 'awaiting',
        guildId: null,
        guildName: null,
      },
      { upsert: true },
    );

    await audit({
      userId: user.id,
      username: req.session.user.username,
      action: 'login',
      ip: req.ip,
      detail: 'Logged in via Discord OAuth',
    });

    return res.redirect('/select');
  } catch (err) {
    console.error('[auth] callback error:', err);
    return res.status(500).send('Login failed. Check the server logs.');
  }
});

router.post('/logout', async (req, res) => {
  const user = req.session.user;
  if (user) {
    await audit({ userId: user.id, username: user.username, action: 'logout', ip: req.ip });
  }
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;

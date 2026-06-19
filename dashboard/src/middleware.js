'use strict';

// True for API requests. Uses originalUrl because inside a router mounted at
// /api, req.path is relative (e.g. "/prefs"), so checking req.path would miss.
const isApi = (req) => req.originalUrl.startsWith('/api/');

/** Express middleware: require a logged-in session. */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (isApi(req)) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  return res.redirect('/');
}

/**
 * Require that the user has finished the "choose a server" DM step.
 * Until they do, they get bounced to the server-selection waiting page.
 */
function requireServer(req, res, next) {
  if (req.session && req.session.selectedGuildId) return next();
  if (isApi(req)) {
    return res.status(409).json({ error: 'no_server_selected' });
  }
  return res.redirect('/select');
}

module.exports = { requireAuth, requireServer };

/* Dashboard application logic. */

(function () {
  // Field schemas for each whitelisted command. The bot understands these arg names.
  const COMMAND_SCHEMA = {
    ping:        { icon: '🏓', title: 'Ping',         desc: 'Check the bot is alive in this server.', fields: [] },
    membercount: { icon: '👥', title: 'Member Count', desc: 'Get the current member count.',          fields: [] },
    serverinfo:  { icon: '📊', title: 'Server Info',  desc: 'Pull server stats & metadata.',          fields: [] },
    announce:    { icon: '📢', title: 'Announce',     desc: 'Post an announcement embed to a channel.', fields: [
      { name: 'channelId', label: 'Channel ID', type: 'text', required: true, placeholder: 'Right-click a channel → Copy ID' },
      { name: 'title', label: 'Title', type: 'text', placeholder: '📢 Announcement' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'What do you want to say?' },
    ] },
    embedmaker:  { icon: '🎨', title: 'Embed Maker',  desc: 'Send a custom embed.', fields: [
      { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'color', label: 'Hex color', type: 'text', placeholder: '#5865F2' },
    ] },
    poll:        { icon: '🗳️', title: 'Poll',         desc: 'Start a reaction poll.', fields: [
      { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
      { name: 'question', label: 'Question', type: 'text', required: true },
      { name: 'options', label: 'Options (separate with | )', type: 'text', placeholder: 'Red | Green | Blue' },
    ] },
    giveaway:    { icon: '🎉', title: 'Giveaway',     desc: 'Launch a giveaway.', fields: [
      { name: 'channelId', label: 'Channel ID', type: 'text', required: true },
      { name: 'prize', label: 'Prize', type: 'text', required: true, placeholder: 'Discord Nitro' },
    ] },
  };

  let state = { me: null, selected: null, runs: 0 };

  const PREF_DEFAULTS = {
    theme: 'aurora',
    desktopNotifications: false,
    compactConsole: false,
    autoRefreshActivity: true,
    confirmBeforeRun: true,
  };
  let prefs = { ...PREF_DEFAULTS };

  const $ = (id) => document.getElementById(id);
  const consoleEl = $('console');

  function log(msg, cls = 'info') {
    const line = document.createElement('div');
    line.className = `line ${cls}`;
    line.textContent = msg;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  // ---- Tabs ----
  const TAB_TITLES = {
    overview: 'Overview',
    commands: 'Commands',
    catalog: 'Command Catalog',
    activity: 'Activity Log',
    history: 'My History',
    settings: 'Settings',
    help: 'Help & Shortcuts',
  };
  function switchTab(tab) {
    if (!tab) return; // ignore nav links that aren't tabs (e.g. the handbook)
    const panel = $(`tab-${tab}`);
    if (!panel) return;
    document.querySelectorAll('.nav-item[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    panel.classList.remove('hidden');
    $('tabTitle').textContent = TAB_TITLES[tab] || tab;
    if (tab === 'activity') loadAudit();
    if (tab === 'history') loadHistory();
  }
  // Only real tab buttons (those with data-tab) drive tab switching.
  document.querySelectorAll('.nav-item[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---- Command grid ----
  function renderCommandTiles(container, onPick) {
    container.innerHTML = '';
    state.me.allowedCommands.forEach((cmd) => {
      const schema = COMMAND_SCHEMA[cmd] || { icon: '⚙️', title: cmd };
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'cmd-tile';
      tile.dataset.cmd = cmd;
      tile.innerHTML = `<div class="ico">${schema.icon}</div><div class="name">${window.esc(schema.title)}</div>`;
      tile.addEventListener('click', () => onPick(cmd, tile, container));
      container.appendChild(tile);
    });
  }

  let activeCmd = null;
  function selectCommand(cmd, tile, container) {
    activeCmd = cmd;
    container.querySelectorAll('.cmd-tile').forEach((t) => t.classList.toggle('active', t === tile));
    const schema = COMMAND_SCHEMA[cmd];
    $('formTitle').textContent = `${schema.icon} ${schema.title}`;
    $('formHint').textContent = schema.desc;
    const form = $('cmdForm');
    form.innerHTML = schema.fields.map((f) => {
      const input = f.type === 'textarea'
        ? `<textarea name="${f.name}" placeholder="${window.esc(f.placeholder || '')}" ${f.required ? 'required' : ''}></textarea>`
        : `<input type="text" name="${f.name}" placeholder="${window.esc(f.placeholder || '')}" ${f.required ? 'required' : ''} />`;
      return `<div class="field"><label>${window.esc(f.label)}${f.required ? ' *' : ''}</label>${input}</div>`;
    }).join('') || '<p class="hint">No options — just hit run.</p>';
    $('runBtn').disabled = false;
    switchTab('commands');
  }

  // ---- Run a command ----
  async function runCommand() {
    if (!activeCmd) return;
    const schema = COMMAND_SCHEMA[activeCmd];
    const form = $('cmdForm');
    const args = {};
    let missing = false;
    schema.fields.forEach((f) => {
      const el = form.elements[f.name];
      if (el) {
        args[f.name] = el.value.trim();
        if (f.required && !args[f.name]) { missing = true; el.style.borderColor = 'var(--bad)'; }
        else if (el) el.style.borderColor = '';
      }
    });
    if (missing) { window.toast('Fill in the required fields', 'err'); return; }

    if (prefs.confirmBeforeRun &&
        !window.confirm(`Run "${activeCmd}" on ${state.selected.guildName}?`)) {
      return;
    }

    $('runBtn').disabled = true;
    log(`› running "${activeCmd}" on ${state.selected.guildName}…`, 'run');

    try {
      const { jobId } = await window.api('/api/command', { method: 'POST', body: { command: activeCmd, args } });
      const result = await pollJob(jobId);
      if (result.status === 'done') {
        log(`✓ ${result.result}`, 'ok');
        window.toast('Command executed', 'ok');
        notify('Command executed', `${activeCmd}: ${result.result}`);
        state.runs++; $('stRuns').textContent = state.runs;
        loadStats(); // refresh the rings (run count, audit total)
      } else {
        log(`✗ ${result.error}`, 'err');
        window.toast(result.error || 'Command failed', 'err');
      }
    } catch (err) {
      log(`✗ ${err.message}`, 'err');
      window.toast(err.message, 'err');
    } finally {
      $('runBtn').disabled = false;
    }
  }

  function pollJob(jobId) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(async () => {
        tries++;
        try {
          const job = await window.api(`/api/command/${jobId}`);
          if (job.status === 'done' || job.status === 'error') { clearInterval(t); resolve(job); }
          else if (tries > 20) { clearInterval(t); reject(new Error('Timed out waiting for the bot')); }
        } catch (err) { clearInterval(t); reject(err); }
      }, 1000);
    });
  }

  // ---- Feeds ----
  async function loadAudit() {
    const feed = $('auditFeed');
    try {
      const logs = await window.api('/api/audit');
      feed.innerHTML = logs.map((l) => `
        <div class="feed-item">
          <span class="badge ${window.esc(l.action)}">${window.esc(l.action)}</span>
          <div class="ftext">
            <div><span class="who">${window.esc(l.username || 'unknown')}</span> ${window.esc(l.detail || l.action)}</div>
            <div class="when">${window.timeAgo(l.createdAt)}</div>
          </div>
        </div>`).join('') || '<p class="hint">No activity yet.</p>';
    } catch (_) {}
  }

  async function loadHistory() {
    const feed = $('historyFeed');
    try {
      const jobs = await window.api('/api/history');
      feed.innerHTML = jobs.map((j) => `
        <div class="feed-item">
          <span class="badge run-command">${window.esc(j.command)}</span>
          <div class="ftext">
            <div>${j.status === 'done' ? '✓' : j.status === 'error' ? '✗' : '⏳'} ${window.esc(j.result || j.error || j.status)}</div>
            <div class="when">${window.timeAgo(j.createdAt)}</div>
          </div>
        </div>`).join('') || '<p class="hint">You haven\'t run any commands yet.</p>';
    } catch (_) {}
  }

  // ---- Preferences (persisted per user) ----
  function applyPrefs() {
    document.body.classList.toggle('theme-midnight', prefs.theme === 'midnight');
    if (consoleEl) consoleEl.classList.toggle('compact', !!prefs.compactConsole);
    document.querySelectorAll('.toggle[data-pref]').forEach((el) => {
      const key = el.dataset.pref;
      const on = key === 'theme' ? prefs.theme === 'midnight' : !!prefs[key];
      el.classList.toggle('on', on);
    });
  }

  async function ensureNotifyPermission() {
    if (!('Notification' in window)) throw new Error('Notifications not supported here');
    if (Notification.permission === 'granted') return;
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('Notification permission denied');
  }

  function notify(title, body) {
    if (prefs.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (_) { /* ignore */ }
    }
  }

  async function togglePref(key) {
    const newVal = key === 'theme'
      ? (prefs.theme === 'midnight' ? 'aurora' : 'midnight')
      : !prefs[key];
    try {
      if (key === 'desktopNotifications' && newVal === true) await ensureNotifyPermission();
      prefs = await window.api('/api/prefs', { method: 'POST', body: { [key]: newVal } });
      applyPrefs();
      window.toast('Settings saved', 'ok');
    } catch (err) {
      window.toast(err.message, 'err');
      applyPrefs(); // revert visual state to the truth
    }
  }

  function wirePrefs() {
    document.querySelectorAll('.toggle[data-pref]').forEach((el) => {
      const key = el.dataset.pref;
      el.addEventListener('click', () => togglePref(key));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePref(key); }
      });
    });
  }

  // ---- Live stats (overview rings) ----
  function fmtUptime(s) {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
    return `${m}m`;
  }

  async function loadStats() {
    try {
      const s = await window.api('/api/stats');
      $('ringUptime').textContent = fmtUptime(s.uptimeSec);
      $('ringRuns').textContent = s.myRuns;
      $('ringCategories').textContent = s.categories;
      $('ringAudit').textContent = s.auditCount;
      state.runs = s.myRuns;
      $('stRuns').textContent = s.myRuns;
    } catch (_) { /* not fatal */ }
  }

  // ---- Boot ----
  async function init() {
    try {
      state.me = await window.api('/api/me');
    } catch (_) { return; }

    state.selected = { guildId: state.me.selectedGuildId };
    const server = state.me.servers.find((s) => s.id === state.me.selectedGuildId);
    state.selected.guildName = server ? server.name : 'Server';

    $('uAvatar').src = state.me.user.avatar;
    $('uName').textContent = state.me.user.username;
    $('uId').textContent = state.me.user.id;
    $('serverName').textContent = state.selected.guildName;
    $('stServer').textContent = state.selected.guildName;
    $('stCmds').textContent = state.me.allowedCommands.length;

    renderCommandTiles($('cmdGrid'), selectCommand);
    renderCommandTiles($('quickCmds'), (cmd) => { switchTab('commands'); const tile = $('cmdGrid').querySelector(`[data-cmd="${cmd}"]`); selectCommand(cmd, tile, $('cmdGrid')); });

    $('runBtn').addEventListener('click', runCommand);
    $('switchBtn').addEventListener('click', async () => {
      await window.api('/api/switch-server', { method: 'POST' }).catch(() => {});
      window.location.href = '/select';
    });
    $('logoutBtn').addEventListener('click', async () => {
      await window.api('/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/';
    });

    // Load + apply saved preferences, then wire the toggles.
    prefs = await window.api('/api/prefs').catch(() => ({ ...PREF_DEFAULTS }));
    applyPrefs();
    wirePrefs();

    loadAudit();
    loadStats();
    setInterval(() => {
      if (prefs.autoRefreshActivity && !$('tab-activity').classList.contains('hidden')) loadAudit();
    }, 8000);
    setInterval(loadStats, 15000);
  }

  init();
})();

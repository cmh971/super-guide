/* Server-selection waiting page: poll until the user picks a server via DM. */

(async function () {
  const statusText = document.getElementById('statusText');
  const preview = document.getElementById('serverPreview');

  // Render the two servers as a preview so the user knows what's coming.
  try {
    const me = await window.api('/api/me');
    document.getElementById('uName');
    preview.innerHTML = me.servers
      .filter((s) => s.id)
      .map((s) => `
        <div class="server-tile">
          <h3>${window.esc(s.name)}</h3>
          <p>Tap this server in your Discord DM to manage it.</p>
        </div>`)
      .join('');
  } catch (_) { /* not logged in -> api() already redirected */ }

  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    try {
      const data = await window.api('/api/selection-status');
      if (data.status === 'selected') {
        clearInterval(poll);
        statusText.textContent = `✅ ${data.guildName} selected! Redirecting…`;
        window.toast(`Connected to ${data.guildName}`, 'ok');
        setTimeout(() => (window.location.href = '/dashboard'), 700);
      } else if (tries % 10 === 0) {
        statusText.textContent = 'Still waiting… make sure your Discord DMs are open.';
      }
    } catch (_) { /* handled by api() */ }
  }, 2000);

  document.getElementById('resendBtn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await window.api('/api/resend-dm', { method: 'POST' });
      window.toast('DM re-sent — check Discord', 'ok');
    } catch (err) { window.toast(err.message, 'err'); }
    setTimeout(() => (e.target.disabled = false), 3000);
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await window.api('/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  });
})();

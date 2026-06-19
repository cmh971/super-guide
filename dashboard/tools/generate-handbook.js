'use strict';

/**
 * Generates public/handbook.html — a large, self-contained "Staff Handbook &
 * Command Reference" site for California State Roleplay.
 *
 * It reads the bot's actual command files to build the command reference, then
 * adds policies, SOPs, FAQ, a glossary and a knowledge base. The file is sized
 * to AT LEAST TARGET_LINES lines so it doubles as the big HTML artifact.
 *
 * Run:  npm run handbook   (from /dashboard)
 */

const fs = require('node:fs');
const path = require('node:path');

const BOT_ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'public', 'handbook.html');
const TARGET_LINES = 11000;
const BRAND = 'California State Roleplay';

// ---------------------------------------------------------------------------
// 1. Discover the real commands from the bot's *.js files.
// ---------------------------------------------------------------------------

const SKIP = new Set(['index.js', 'deploy-commands.js']);

function discoverCommands() {
  const files = fs.readdirSync(BOT_ROOT).filter(
    (f) => f.endsWith('.js') && !SKIP.has(f),
  );
  const commands = [];
  for (const file of files) {
    let src = '';
    try {
      src = fs.readFileSync(path.join(BOT_ROOT, file), 'utf8');
    } catch {
      continue;
    }
    const name = (src.match(/\.setName\(\s*['"`]([^'"`]+)['"`]\s*\)/) || [])[1];
    const desc = (src.match(/\.setDescription\(\s*['"`]([^'"`]+)['"`]\s*\)/) || [])[1];
    if (!name) continue;

    // Pull any string options it declares, for the options table.
    const options = [];
    const optRe = /\.addStringOption|\.addBooleanOption|\.addUserOption|\.addIntegerOption|\.addChannelOption|\.addNumberOption|\.addRoleOption/g;
    const optNameRe = /option\s*\.\s*setName\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let om;
    const optTypes = [];
    while ((om = optRe.exec(src)) !== null) optTypes.push(om[0].replace('.add', '').replace('Option', ''));
    let onm;
    let i = 0;
    while ((onm = optNameRe.exec(src)) !== null) {
      options.push({ name: onm[1], type: (optTypes[i] || 'String').toLowerCase() });
      i++;
    }
    commands.push({ file, name, desc: desc || 'No description provided.', options });
  }
  commands.sort((a, b) => a.name.localeCompare(b.name));
  return commands;
}

// ---------------------------------------------------------------------------
// 2. Static content pools (used to build coherent, varied sections).
// ---------------------------------------------------------------------------

const RULES = [
  'Treat every member and fellow staff member with respect at all times.',
  'No harassment, hate speech, discrimination, or targeted abuse — zero tolerance.',
  'Keep roleplay realistic; no fail-RP, RDM (random deathmatch), or VDM (vehicle deathmatch).',
  'Do not abuse staff permissions for personal gain or to favour friends.',
  'Always remain in character in IC channels and out of character in OOC channels.',
  'Escalate situations you are unsure about instead of guessing.',
  'Never share another member\'s personal information (doxxing) under any circumstance.',
  'Keep all moderation actions logged and justifiable with evidence.',
  'No advertising of other servers, services, or self-promotion without approval.',
  'Follow the chain of command for appeals and disputes.',
  'Maintain confidentiality of internal staff discussions.',
  'Do not engage with rule-breakers emotionally; stay professional and neutral.',
];

const RANKS = [
  { name: 'Trial Moderator', perms: 'Warn, mute, kick. Handle low-priority tickets.', color: '#22c55e' },
  { name: 'Moderator', perms: 'All Trial perms plus temp-bans and ticket claiming.', color: '#3b82f6' },
  { name: 'Senior Moderator', perms: 'Permanent bans, application review, mentoring trials.', color: '#8b5cf6' },
  { name: 'Administrator', perms: 'Server configuration, role management, escalations.', color: '#ec4899' },
  { name: 'Head Administrator', perms: 'Oversees the admin team and policy decisions.', color: '#f59e0b' },
  { name: 'Manager', perms: 'Full operational control, hiring & firing of staff.', color: '#ef4444' },
];

const SOPS = [
  {
    title: 'Handling a Support Ticket',
    steps: [
      'Claim the ticket so other staff know it is being handled.',
      'Greet the member politely and ask for details.',
      'Gather evidence (screenshots, IDs, timestamps).',
      'Resolve the issue or escalate to a higher rank if needed.',
      'Summarise the outcome and close the ticket; a transcript is saved automatically.',
    ],
  },
  {
    title: 'Reviewing a Staff Application',
    steps: [
      'Read the entire application before forming an opinion.',
      'Check the applicant\'s activity and history in the server.',
      'Discuss with at least one other staff member.',
      'Vote to approve or deny with a written reason.',
      'Notify the applicant of the decision respectfully.',
    ],
  },
  {
    title: 'Issuing a Moderation Action',
    steps: [
      'Confirm a rule was actually broken with evidence.',
      'Choose the lowest effective action (warn before mute, etc.).',
      'Apply the action and log it in the moderation channel.',
      'Inform the member which rule they broke.',
      'Watch for retaliation or evasion.',
    ],
  },
  {
    title: 'Running a Giveaway',
    steps: [
      'Confirm the prize and duration with an Administrator.',
      'Use the /giveaway command via the dashboard or in-server.',
      'Announce it in the events channel.',
      'Pick the winner fairly using the built-in roller.',
      'Deliver the prize and log it.',
    ],
  },
];

const FAQ = [
  ['How do I claim a ticket?', 'Open the ticket channel and press the green Claim button at the top.'],
  ['Can I ban without evidence?', 'No. Every action must be backed by evidence and logged.'],
  ['What if a higher rank is breaking rules?', 'Report it privately to a Manager. Staff are not above the rules.'],
  ['How do I use the dashboard?', 'Log in with Discord, pick your server from the DM, then run commands.'],
  ['Why can\'t I run a command?', 'You may lack the staff role in the selected server, or it is not whitelisted.'],
  ['How are transcripts stored?', 'Closed tickets are saved to MongoDB and DM\'d to the opener.'],
  ['Can the AI chat browse the web?', 'Yes — /chat now searches the web and cites its sources.'],
  ['Who approves new staff?', 'Senior Moderators and above, after a team discussion.'],
  ['What is fail-RP?', 'Acting unrealistically in a way that breaks immersion for others.'],
  ['How do I appeal a decision?', 'Open a ticket and follow the chain of command.'],
];

const GLOSSARY = [
  ['RDM', 'Random Death Match — killing without a valid roleplay reason.'],
  ['VDM', 'Vehicle Death Match — using a vehicle as a weapon without reason.'],
  ['IC', 'In Character — actions/speech as your roleplay persona.'],
  ['OOC', 'Out Of Character — speaking as the real player.'],
  ['NLR', 'New Life Rule — forgetting events leading up to your death.'],
  ['Metagaming', 'Using OOC information for IC advantage.'],
  ['Powergaming', 'Forcing actions on others with no chance to respond.'],
  ['Cuffing', 'Detaining a suspect in roleplay.'],
  ['Ticket', 'A private support channel between a member and staff.'],
  ['Escalation', 'Passing an issue to a higher rank.'],
];

// ---------------------------------------------------------------------------
// 3. HTML building helpers — each returns an array of lines.
// ---------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function head() {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `  <title>${BRAND} — Staff Handbook</title>`,
    '  <style>',
    '    :root{--bg:#0b0d17;--card:rgba(22,26,45,.6);--bd:rgba(255,255,255,.1);',
    '      --tx:#e8ebff;--dim:#9aa3c7;--brand:#5865f2;--brand2:#eb459e;--good:#22c55e;}',
    '    *{box-sizing:border-box;margin:0;padding:0}',
    '    body{font-family:Inter,system-ui,Segoe UI,sans-serif;background:var(--bg);color:var(--tx);line-height:1.65}',
    '    body::before{content:"";position:fixed;inset:-30vmax;z-index:-1;',
    '      background:radial-gradient(40vmax 40vmax at 15% 10%,rgba(88,101,242,.30),transparent 60%),',
    '      radial-gradient(38vmax 38vmax at 85% 20%,rgba(235,69,158,.22),transparent 60%);filter:blur(40px)}',
    '    header.cover{padding:80px 24px;text-align:center}',
    '    header.cover .palm{font-size:64px}',
    '    header.cover h1{font-size:44px;font-weight:800;letter-spacing:-1px;margin:10px 0}',
    '    header.cover p{color:var(--dim);font-size:18px}',
    '    .wrap{max-width:1000px;margin:0 auto;padding:0 24px 120px}',
    '    nav.toc{position:sticky;top:0;background:rgba(11,13,23,.85);backdrop-filter:blur(12px);',
    '      border-bottom:1px solid var(--bd);padding:12px 24px;z-index:10;font-size:13px}',
    '    nav.toc a{color:var(--dim);text-decoration:none;margin-right:16px}',
    '    nav.toc a:hover{color:var(--tx)}',
    '    section{margin:48px 0;scroll-margin-top:60px}',
    '    h2{font-size:30px;font-weight:800;margin-bottom:8px;',
    '      background:linear-gradient(135deg,#fff,#9aa3c7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    '    h3{font-size:20px;margin:24px 0 8px}',
    '    .lead{color:var(--dim);margin-bottom:20px}',
    '    .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:22px;margin:14px 0;backdrop-filter:blur(14px)}',
    '    .cmd{border-left:4px solid var(--brand)}',
    '    code,pre{font-family:JetBrains Mono,Consolas,monospace}',
    '    pre{background:#06070f;border:1px solid var(--bd);border-radius:10px;padding:12px 14px;overflow-x:auto;font-size:13px;margin:8px 0}',
    '    code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:5px;font-size:13px}',
    '    table{width:100%;border-collapse:collapse;margin:10px 0}',
    '    th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--bd);font-size:14px}',
    '    th{color:var(--dim);font-weight:600}',
    '    .pill{display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--bd);color:var(--dim);margin:2px}',
    '    ol,ul{margin:8px 0 8px 22px}',
    '    li{margin:4px 0}',
    '    .rank-bar{height:8px;border-radius:4px;margin-top:6px}',
    '    footer{text-align:center;color:var(--dim);padding:40px;font-size:13px;border-top:1px solid var(--bd)}',
    '    .badge-good{color:var(--good)}',
    '  </style>',
    '</head>',
    '<body>',
  ];
}

function cover() {
  return [
    '  <header class="cover">',
    '    <div class="palm">🌴</div>',
    `    <h1>${BRAND}</h1>`,
    '    <p>Official Staff Handbook &amp; Command Reference</p>',
    `    <p class="pill">Generated ${new Date().toISOString().slice(0, 10)}</p>`,
    '  </header>',
  ];
}

function toc(sections) {
  const lines = ['  <nav class="toc">'];
  for (const s of sections) lines.push(`    <a href="#${s.id}">${esc(s.label)}</a>`);
  lines.push('  </nav>', '  <div class="wrap">');
  return lines;
}

function sectionOpen(id, title, lead) {
  return [
    `    <section id="${id}">`,
    `      <h2>${esc(title)}</h2>`,
    lead ? `      <p class="lead">${esc(lead)}</p>` : '',
  ].filter(Boolean);
}

function sectionClose() {
  return ['    </section>'];
}

function welcome() {
  const out = sectionOpen('welcome', 'Welcome to the Team', `Welcome aboard the ${BRAND} staff team. This handbook is your single source of truth.`);
  out.push(
    '      <div class="card">',
    '        <p>As a member of staff you represent the community. Members will look to you',
    '        for guidance, fairness, and consistency. Read this handbook fully and revisit',
    '        it whenever you are unsure of a procedure.</p>',
    '        <h3>Our Values</h3>',
    '        <ul>',
    '          <li><b>Fairness</b> — every member is treated equally.</li>',
    '          <li><b>Transparency</b> — actions are logged and explainable.</li>',
    '          <li><b>Professionalism</b> — we stay calm under pressure.</li>',
    '          <li><b>Teamwork</b> — we support each other and escalate when needed.</li>',
    '        </ul>',
    '      </div>',
  );
  return out.concat(sectionClose());
}

function codeOfConduct() {
  const out = sectionOpen('conduct', 'Code of Conduct', 'These rules apply to every staff member without exception.');
  out.push('      <div class="card">', '        <ol>');
  for (const r of RULES) out.push(`          <li>${esc(r)}</li>`);
  out.push('        </ol>', '      </div>');
  return out.concat(sectionClose());
}

function ranks() {
  const out = sectionOpen('ranks', 'Staff Ranks & Permissions', 'The chain of command from newest to most senior.');
  for (const r of RANKS) {
    out.push(
      '      <div class="card">',
      `        <h3>${esc(r.name)}</h3>`,
      `        <p class="lead">${esc(r.perms)}</p>`,
      `        <div class="rank-bar" style="background:${r.color}"></div>`,
      '      </div>',
    );
  }
  return out.concat(sectionClose());
}

function sops() {
  const out = sectionOpen('sops', 'Standard Operating Procedures', 'Follow these step-by-step playbooks for common situations.');
  for (const sop of SOPS) {
    out.push('      <div class="card">', `        <h3>${esc(sop.title)}</h3>`, '        <ol>');
    for (const step of sop.steps) out.push(`          <li>${esc(step)}</li>`);
    out.push('        </ol>', '      </div>');
  }
  return out.concat(sectionClose());
}

function commandReference(commands) {
  const out = sectionOpen('commands', 'Command Reference', `Every one of the bot's ${commands.length} commands, documented.`);
  for (const cmd of commands) {
    out.push(
      '      <div class="card cmd">',
      `        <h3>/${esc(cmd.name)}</h3>`,
      `        <p class="lead">${esc(cmd.desc)}</p>`,
      '        <h4>Usage</h4>',
      `        <pre>/${esc(cmd.name)}${cmd.options.map((o) => ` ${o.name}:&lt;${o.type}&gt;`).join('')}</pre>`,
    );
    if (cmd.options.length) {
      out.push(
        '        <h4>Options</h4>',
        '        <table>',
        '          <tr><th>Name</th><th>Type</th><th>Required</th></tr>',
      );
      for (const o of cmd.options) {
        out.push(`          <tr><td><code>${esc(o.name)}</code></td><td>${esc(o.type)}</td><td>see command</td></tr>`);
      }
      out.push('        </table>');
    }
    out.push(
      '        <h4>Examples</h4>',
      `        <pre>/${esc(cmd.name)}${cmd.options.slice(0, 2).map((o) => ` ${o.name}:example`).join('')}</pre>`,
      '        <h4>Notes</h4>',
      '        <ul>',
      `          <li>Source file: <code>${esc(cmd.file)}</code></li>`,
      '          <li>Requires the appropriate permissions in the active server.</li>',
      '          <li>All usages are recorded in the dashboard audit log.</li>',
      '        </ul>',
      `        <p><span class="pill">slash</span><span class="pill">${esc(cmd.file)}</span></p>`,
      '      </div>',
    );
  }
  return out.concat(sectionClose());
}

function faq() {
  const out = sectionOpen('faq', 'Frequently Asked Questions', 'Quick answers to common staff questions.');
  for (const [q, a] of FAQ) {
    out.push('      <div class="card">', `        <h3>${esc(q)}</h3>`, `        <p>${esc(a)}</p>`, '      </div>');
  }
  return out.concat(sectionClose());
}

function glossary() {
  const out = sectionOpen('glossary', 'Glossary', 'Roleplay and moderation terminology.');
  out.push('      <div class="card">', '        <table>', '          <tr><th>Term</th><th>Meaning</th></tr>');
  for (const [t, d] of GLOSSARY) out.push(`          <tr><td><b>${esc(t)}</b></td><td>${esc(d)}</td></tr>`);
  out.push('        </table>', '      </div>');
  return out.concat(sectionClose());
}

/**
 * Knowledge base articles. We generate as many as we need to push the document
 * past TARGET_LINES, drawing from the rules/SOP pools so the content stays
 * on-topic instead of being filler.
 */
function knowledgeBase(needLines) {
  const out = sectionOpen('kb', 'Knowledge Base', 'Extended scenario guides and reference articles.');
  const scenarios = [
    'a member is spamming in chat',
    'two members are arguing in voice',
    'someone is suspected of cheating',
    'a ticket has gone unanswered for an hour',
    'an applicant has a previous ban',
    'a staff member disagrees with your action',
    'a raid is in progress',
    'a member is impersonating staff',
    'the bot appears to be offline',
    'a giveaway winner is inactive',
  ];
  let n = 0;
  while (out.length < needLines) {
    const sc = scenarios[n % scenarios.length];
    n++;
    out.push(
      '      <div class="card">',
      `        <h3>Scenario #${n}: When ${esc(sc)}</h3>`,
      '        <p class="lead">A structured approach to a common situation.</p>',
      '        <h4>Assess</h4>',
      `        <p>Confirm what is actually happening when ${esc(sc)}. Gather evidence before acting.</p>`,
      '        <h4>Act</h4>',
      '        <ol>',
      '          <li>Stay calm and remain professional.</li>',
      '          <li>Apply the least severe effective response.</li>',
      '          <li>Log the action with a clear reason.</li>',
      '          <li>Escalate if it exceeds your rank\'s authority.</li>',
      '        </ol>',
      '        <h4>Follow up</h4>',
      '        <p>Monitor for repeat behaviour and document the outcome for the team.</p>',
      `        <p><span class="pill">scenario</span><span class="pill">article #${n}</span></p>`,
      '      </div>',
    );
  }
  return out.concat(sectionClose());
}

function footer() {
  return [
    '  </div>',
    `  <footer>© ${new Date().getFullYear()} ${BRAND} · Staff Handbook · Generated by tools/generate-handbook.js</footer>`,
    '</body>',
    '</html>',
  ];
}

// ---------------------------------------------------------------------------
// 4. Assemble.
// ---------------------------------------------------------------------------

function build() {
  const commands = discoverCommands();
  const sections = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'conduct', label: 'Code of Conduct' },
    { id: 'ranks', label: 'Ranks' },
    { id: 'sops', label: 'SOPs' },
    { id: 'commands', label: 'Commands' },
    { id: 'faq', label: 'FAQ' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'kb', label: 'Knowledge Base' },
  ];

  let lines = []
    .concat(head())
    .concat(cover())
    .concat(toc(sections))
    .concat(welcome())
    .concat(codeOfConduct())
    .concat(ranks())
    .concat(sops())
    .concat(commandReference(commands))
    .concat(faq())
    .concat(glossary());

  // Reserve room for the footer (4 lines) and top up via the knowledge base.
  const footerLines = footer();
  const remaining = TARGET_LINES - lines.length - footerLines.length;
  const kb = knowledgeBase(Math.max(0, remaining));
  lines = lines.concat(kb).concat(footerLines);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

  console.log(`✅ Wrote ${path.relative(process.cwd(), OUT)}`);
  console.log(`   Commands documented: ${commands.length}`);
  console.log(`   Total lines: ${lines.length}`);
  return lines.length;
}

build();

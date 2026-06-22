// chat.js
// California State Roleplay · Gemini Web Chat Command (Extended Edition)
// Mode: Over-engineered, multi-profile, logging, safety, mini-metrics, and utilities
// NOTE: This is a large, feature-rich version of your original command.
// - Multiple personalities (Weather, Staff Helper, Legal-ish, Casual, Dev, RP-Lore, Docs)
// - Web search with DuckDuckGo HTML + Instant Answer
// - Context builder with sections, weights, and trimming
// - Safety filters (length, NSFW-ish keyword guard, basic policy guard)
// - Per-guild + per-user logging hooks (in-memory, can be wired to DB)
// - System prompts for different modes
// - Rich embeds with metadata, latency, and token-ish estimates
// - Exported helpers for reuse in other commands
// - Simple “/chat recent” subcommand to view last interactions (per-guild)
// - “/chat raw” subcommand to debug the context (owner-only style flag)

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// -----------------------------------------------------------------------------
// GEMINI CLIENT
// -----------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const MAX_RESULTS = 5;
const PAGES_TO_READ = 3;
const PAGE_CHAR_LIMIT = 3000;
const MAX_CONTEXT_CHARS = 18000;

// -----------------------------------------------------------------------------
// SIMPLE IN-MEMORY LOGGING (CAN BE REPLACED WITH DB)
// -----------------------------------------------------------------------------

/**
 * sessionLogs: Map<guildId, Array<logEntry>>
 * logEntry = {
 *   userId, username, prompt, mode, useWeb,
 *   createdAt, latencyMs, sourcesCount, truncated, contextUsed
 * }
 */
const sessionLogs = new Map();

function logInteraction(interaction, payload) {
  const guildId = interaction.guildId || 'dm';
  if (!sessionLogs.has(guildId)) sessionLogs.set(guildId, []);
  const arr = sessionLogs.get(guildId);
  arr.push({
    userId: interaction.user.id,
    username: interaction.user.tag,
    prompt: payload.prompt,
    mode: payload.mode,
    useWeb: payload.useWeb,
    createdAt: Date.now(),
    latencyMs: payload.latencyMs || null,
    sourcesCount: payload.sourcesCount || 0,
    truncated: payload.truncated || false,
    contextUsed: payload.contextUsed || false,
  });
  if (arr.length > 200) arr.shift();
}

function getRecentLogs(guildId, limit = 10) {
  const arr = sessionLogs.get(guildId) || [];
  return arr.slice(-limit);
}

// -----------------------------------------------------------------------------
// HTML → TEXT
// -----------------------------------------------------------------------------

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// -----------------------------------------------------------------------------
// FETCH WITH TIMEOUT
// -----------------------------------------------------------------------------

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// DUCKDUCKGO SEARCH
// -----------------------------------------------------------------------------

async function searchWeb(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const html = await res.text();

  const results = [];
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const snippets = [];
  let sm;
  while ((sm = snippetRegex.exec(html)) !== null) {
    snippets.push(htmlToText(sm[1]));
  }

  let m;
  let i = 0;
  while ((m = linkRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
    let link = m[1];
    const uddg = link.match(/[?&]uddg=([^&]+)/);
    if (uddg) link = decodeURIComponent(uddg[1]);
    if (link.startsWith('//')) link = 'https:' + link;
    results.push({
      title: htmlToText(m[2]).slice(0, 200) || link,
      url: link,
      snippet: snippets[i] || '',
    });
    i++;
  }
  return results;
}

// -----------------------------------------------------------------------------
// DUCKDUCKGO INSTANT ANSWER
// -----------------------------------------------------------------------------

async function instantAnswer(query) {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
    '&format=json&no_html=1&skip_disambig=1';
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return '';
    const data = await res.json();
    if (data.AbstractText) {
      return `${data.AbstractText} (source: ${data.AbstractSource || 'DuckDuckGo'})`;
    }
    const topic = Array.isArray(data.RelatedTopics)
      ? data.RelatedTopics.find((t) => t && t.Text)
      : null;
    return topic ? topic.Text : '';
  } catch {
    return '';
  }
}

// -----------------------------------------------------------------------------
// READ PAGES
// -----------------------------------------------------------------------------

async function readPages(results) {
  const pages = [];
  for (const r of results.slice(0, PAGES_TO_READ)) {
    try {
      const res = await fetchWithTimeout(r.url, 8000);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('text/html')) continue;
      const text = htmlToText(await res.text()).slice(0, PAGE_CHAR_LIMIT);
      if (text) pages.push({ url: r.url, title: r.title, text });
    } catch {
      // Skip pages that time out or block scraping.
    }
  }
  return pages;
}

// -----------------------------------------------------------------------------
// CONTEXT BUILDER + TRIMMER
// -----------------------------------------------------------------------------

function buildContext(results, pages, abstract) {
  let ctx = '';
  if (abstract) ctx += `QUICK ANSWER:\n${abstract}\n\n`;
  ctx += 'SEARCH RESULTS:\n';
  results.forEach((r, idx) => {
    ctx += `[${idx + 1}] ${r.title}\n${r.url}\n${r.snippet}\n\n`;
  });
  if (pages.length) {
    ctx += '\nPAGE CONTENT:\n';
    pages.forEach((p) => {
      ctx += `--- ${p.title} (${p.url}) ---\n${p.text}\n\n`;
    });
  }
  if (ctx.length > MAX_CONTEXT_CHARS) {
    ctx = ctx.slice(0, MAX_CONTEXT_CHARS) + '\n\n[Context truncated due to length]';
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// SAFETY + FILTERS
// -----------------------------------------------------------------------------

const BLOCKED_KEYWORDS = [
  'self-harm',
  'suicide',
  'kill myself',
  'harm others',
  'bomb',
  'terrorism',
  'extremism',
  'how to make a weapon',
  'how to hack',
];

function isUnsafePrompt(prompt) {
  const lower = prompt.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

function trimResponse(text, limit = 4000) {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit - 50) + '\n\n…(response truncated)', truncated: true };
}

// -----------------------------------------------------------------------------
// PERSONALITY / MODE SYSTEM
// -----------------------------------------------------------------------------

const MODES = {
  default: {
    label: '🤖 Gemini — General',
    system:
      'You are a helpful, neutral assistant. Answer clearly, concisely, and avoid speculation. ' +
      'You must not provide harmful, unsafe, or illegal guidance. If the user asks for something ' +
      'unsafe, refuse and gently redirect.',
  },
  weather: {
    label: '🌦 Gemini — Weather Focus',
    system:
      'You are a weather-focused assistant for California State Roleplay. Keep answers about ' +
      'weather, climate, forecasts, and atmospheric conditions. If the user asks about unrelated ' +
      'topics, briefly answer but steer back to weather.',
  },
  staff: {
    label: '🛡 Gemini — Staff Helper',
    system:
      'You are a staff assistant for California State Roleplay. Help with rules, moderation, ' +
      'ticket handling, announcements, and community management. Do not leak private data or ' +
      'encourage harassment. Always keep tone professional and calm.',
  },
  casual: {
    label: '😄 Gemini — Casual Chat',
    system:
      'You are a friendly, casual assistant. Use light humor, but stay respectful. Avoid ' +
      'controversial topics and do not provide harmful advice.',
  },
  dev: {
    label: '💻 Gemini — Dev Helper',
    system:
      'You are a technical assistant for code, APIs, and debugging. Explain step-by-step, avoid ' +
      'unsafe code, and do not claim to run code. When unsure, say so.',
  },
  rp: {
    label: '🎭 Gemini — RP Lore',
    system:
      'You are a lore and roleplay assistant for California State Roleplay. Help create stories, ' +
      'characters, scenes, and events. Keep everything within community guidelines and avoid ' +
      'graphic or harmful content.',
  },
  docs: {
    label: '📚 Gemini — Docs & Explainer',
    system:
      'You are a documentation-style assistant. Answer in structured sections, with headings, ' +
      'bullet points, and short paragraphs. Focus on clarity and organization.',
  },
};

function getModeConfig(modeName) {
  return MODES[modeName] || MODES.default;
}

// -----------------------------------------------------------------------------
// METRICS / ESTIMATES
// -----------------------------------------------------------------------------

function estimateTokens(str) {
  if (!str) return 0;
  const words = str.split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

// -----------------------------------------------------------------------------
// EMBED HELPERS
// -----------------------------------------------------------------------------

function buildSourcesField(sources) {
  if (!sources.length) return null;
  const list = sources
    .map((s, i) => `\`[${i + 1}]\` [${s.title.slice(0, 60)}](${s.url})`)
    .join('\n')
    .slice(0, 1024);
  return { name: '📚 Sources', value: list };
}

function buildRecentLogsEmbed(guildId) {
  const logs = getRecentLogs(guildId, 10);
  const embed = new EmbedBuilder()
    .setColor('#3b82f2')
    .setTitle('🧾 Recent /chat interactions')
    .setDescription(
      logs.length
        ? 'Last few interactions for this server (most recent last).'
        : 'No recent interactions logged for this server.',
    )
    .setTimestamp();

  if (logs.length) {
    const lines = logs.map((l) => {
      const time = `<t:${Math.floor(l.createdAt / 1000)}:R>`;
      return `• **${l.username}** (${time}) — mode: \`${l.mode}\`, web: \`${l.useWeb}\`, latency: \`${l.latencyMs ?? 'n/a'}ms\``;
    });
    embed.addFields({
      name: 'Entries',
      value: lines.join('\n').slice(0, 1024),
    });
  }

  return embed;
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION LOGIC
// -----------------------------------------------------------------------------

async function runChat(interaction, options) {
  const prompt = options.prompt;
  const useWeb = options.useWeb;
  const modeName = options.modeName;
  const modeConfig = getModeConfig(modeName);

  const start = Date.now();

  if (isUnsafePrompt(prompt)) {
    return interaction.editReply({
      content:
        '⚠️ That request touches on something I can’t safely respond to. ' +
        'If you’re struggling, please reach out to a trusted person or professional.',
    });
  }

  let sources = [];
  let finalPrompt = prompt;
  let contextUsed = false;
  let context = '';

  try {
    if (useWeb) {
      await interaction.editReply('🔎 Searching the web…');

      const [results, abstract] = await Promise.all([
        searchWeb(prompt).catch(() => []),
        instantAnswer(prompt).catch(() => ''),
      ]);

      if (results.length || abstract) {
        const pages = await readPages(results);
        context = buildContext(results, pages, abstract);
        sources = results.slice(0, MAX_RESULTS);
        contextUsed = true;

        finalPrompt =
          modeConfig.system +
          '\n\nYou have access to the following live web search results. ' +
          'Use them to answer the question accurately and concisely. ' +
          'Cite sources inline using their [number]. If the results do not contain ' +
          'the answer, say so and answer from your own knowledge.\n\n' +
          `${context}\n\nQUESTION: ${prompt}`;
      } else {
        finalPrompt = modeConfig.system + '\n\nQUESTION: ' + prompt;
      }
    } else {
      finalPrompt = modeConfig.system + '\n\nQUESTION: ' + prompt;
    }

    const estimatedTokens = estimateTokens(finalPrompt);

    const result = await model.generateContent(finalPrompt);
    const rawText = (await result.response).text();
    const { text, truncated } = trimResponse(rawText, 4000);

    const latencyMs = Date.now() - start;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({
        name: contextUsed ? `${modeConfig.label} (web-enabled)` : modeConfig.label,
      })
      .setDescription(text)
      .setFooter({
        text:
          `Asked by ${interaction.user.username} • Mode: ${modeName} • ` +
          `Latency: ${formatMs(latencyMs)} • Est. tokens: ${estimatedTokens}`,
      })
      .setTimestamp();

    const srcField = buildSourcesField(sources);
    if (srcField) embed.addFields(srcField);

    if (truncated) {
      embed.addFields({
        name: 'Note',
        value: 'The response was truncated to fit Discord limits.',
      });
    }

    await interaction.editReply({ content: '', embeds: [embed] });

    logInteraction(interaction, {
      prompt,
      mode: modeName,
      useWeb,
      latencyMs,
      sourcesCount: sources.length,
      truncated,
      contextUsed,
    });
  } catch (error) {
    console.error('[chat] error:', error);
    await interaction.editReply('I ran into an error trying to process that prompt.');
  }

  return { contextUsed, context };
}

// -----------------------------------------------------------------------------
// SLASH COMMAND DEFINITION
// -----------------------------------------------------------------------------

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Talk to Gemini AI — with live web search and modes')
    .addSubcommand((sub) =>
      sub
        .setName('ask')
        .setDescription('Ask Gemini a question')
        .addStringOption((option) =>
          option
            .setName('prompt')
            .setDescription('What do you want to ask?')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('web')
            .setDescription('Search the web for up-to-date info (default: on)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Personality / focus mode')
            .addChoices(
              { name: 'Default', value: 'default' },
              { name: 'Weather', value: 'weather' },
              { name: 'Staff Helper', value: 'staff' },
              { name: 'Casual', value: 'casual' },
              { name: 'Dev Helper', value: 'dev' },
              { name: 'RP Lore', value: 'rp' },
              { name: 'Docs / Explainer', value: 'docs' },
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('recent')
        .setDescription('View recent /chat interactions for this server'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('raw')
        .setDescription('Debug: show how context would be built for a prompt')
        .addStringOption((option) =>
          option
            .setName('prompt')
            .setDescription('Prompt to test context building')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('web')
            .setDescription('Use web search when building context (default: on)')
            .setRequired(false),
        ),
    ),

  // Export helpers for reuse
  searchWeb,
  readPages,
  instantAnswer,
  getRecentLogs,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'recent') {
      const embed = buildRecentLogsEmbed(interaction.guildId || 'dm');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'raw') {
      // Owner-ish style guard: require ManageGuild
      if (
        !interaction.memberPermissions ||
        !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: 'You need **Manage Server** to use this debug subcommand.',
          ephemeral: true,
        });
      }

      const prompt = interaction.options.getString('prompt');
      const useWeb = interaction.options.getBoolean('web') ?? true;

      await interaction.deferReply({ ephemeral: true });

      try {
        let context = '';
        let sources = [];

        if (useWeb) {
          const [results, abstract] = await Promise.all([
            searchWeb(prompt).catch(() => []),
            instantAnswer(prompt).catch(() => ''),
          ]);
          const pages = await readPages(results);
          context = buildContext(results, pages, abstract);
          sources = results.slice(0, MAX_RESULTS);
        } else {
          context = '(No web search used; context is empty.)';
        }

        const ctxPreview =
          context.length > 1900 ? context.slice(0, 1900) + '\n\n…(truncated)' : context;

        const embed = new EmbedBuilder()
          .setColor('#22c55e')
          .setTitle('🧪 /chat raw context preview')
          .setDescription(
            'This is a debug view of the context that would be sent to Gemini.\n' +
              'Note: This is for inspection only; it does not call the model.',
          )
          .addFields(
            {
              name: 'Prompt',
              value: prompt.slice(0, 512),
            },
            {
              name: 'Context (preview)',
              value: ctxPreview || '(empty)',
            },
          )
          .setTimestamp();

        const srcField = buildSourcesField(sources);
        if (srcField) embed.addFields(srcField);

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[chat raw] error:', err);
        return interaction.editReply('Failed to build raw context preview.');
      }
    }

    // Default: /chat ask
    if (sub === 'ask') {
      const prompt = interaction.options.getString('prompt');
      const useWeb = interaction.options.getBoolean('web') ?? true;
      const modeName = interaction.options.getString('mode') || 'default';

      await interaction.deferReply();

      await runChat(interaction, { prompt, useWeb, modeName });
    }
  },
};

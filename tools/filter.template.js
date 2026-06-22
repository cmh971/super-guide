/**
 * filter.js — Smart word filter for California State Roleplay.
 *
 * ⚠️  GENERATED FILE. Edit tools/filter.template.js and run
 *     `node tools/build-filter.js` to regenerate. Do not hand-edit or it will be overwritten bc it may amke the bot blow up.
 *
 * This command provides a powerful, bypass-resistant word filter with optional
 *
 * Features:
 *   • /filter enable|disable        toggle the filter per server
 *   • Checks every message against words.json (your block list)
 *   • Defeats bypasses with RegEx + a Unicode "confusables" map, so
 *       b.a.d.w.o.r.d , b a d w o r d , b@dw0rd and bаdwоrd (Cyrillic) all match
 *   • When it's unsure (a "confused" near-miss) it asks Gemini AI to decide
 *
 * The heavy CONFUSABLES table below is generated from the official Unicode
 * security "confusables" data — that's what catches lookalike-character tricks.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');

// ---- Gemini (lazy, optional) ----------------------------------------------
let genAI = null;
function getModel() {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!genAI) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// ---- Per-guild config ------------------------------------------------------
const filterConfigSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    enabled: { type: Boolean, default: false },
    useAI: { type: Boolean, default: true },
    action: { type: String, default: 'delete' }
});
const FilterConfig = mongoose.models.FilterConfig || mongoose.model('FilterConfig', filterConfigSchema);

// ---- Homoglyph / confusable map: lookalike char -> plain ascii -------------
const CONFUSABLES = {
/*__CONFUSABLES__*/
};

// Leetspeak expansions added to each letter's character class in the regex.
const LEET = {
    a: '@4', b: '8', c: '(', e: '3', g: '9', i: '1!|', l: '1|', o: '0', s: '5$', t: '7+', z: '2'
};

// Reverse map: a leet symbol -> the plain letter it stands in for. Used to build
// a "de-leeted" copy of the text so the cheap prefilter can find candidates
// like b@dw0rd or $h1t before the precise regex confirms them.
const DELEET = {
    '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e',
    '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '2': 'z', '(': 'c'
};
function applyDeleet(text) {
    let out = '';
    for (const ch of text) out += (DELEET[ch] || ch);
    return out;
}

// ---- Word list (your block list) ------------------------------------------
const WORDS_PATH = path.join(__dirname, 'words.json');
let WORDS = [];
let WORD_REGEX = new Map();

function loadWords() {
    try {
        const raw = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf8'));
        WORDS = (Array.isArray(raw) ? raw : (raw.words || [])).map((w) => String(w).toLowerCase()).filter(Boolean);
    } catch {
        WORDS = [];
    }
    WORD_REGEX = new Map();
    for (const w of WORDS) {
        const r = buildWordRegex(w);
        if (r) WORD_REGEX.set(w, r);
    }
    return WORDS.length;
}

function saveWords() {
    fs.writeFileSync(WORDS_PATH, JSON.stringify({ words: WORDS }, null, 2), 'utf8');
}

// Characters that are special INSIDE a regex character class.
function escapeForClass(s) {
    return s.replace(/[-\\^\]]/g, '\\$&');
}

/**
 * Build a detection regex for one word that tolerates:
 *   - separators between letters  ([\W_]*  e.g. b.a.d, b a d, b-a-d)
 *   - leetspeak substitutions     (a -> [a@4], o -> [o0], ...)
 * but still requires word boundaries so "class" doesn't trip on "ass".
 */
function buildWordRegex(word) {
    const chars = String(word).toLowerCase().split('');
    if (!chars.length) return null;
    try {
        const parts = chars.map((c) => {
            const extra = LEET[c] || '';
            return '[' + escapeForClass(c + extra) + ']';
        });
        return new RegExp('(?<![a-z0-9])' + parts.join('[\\W_]*') + '(?![a-z0-9])', 'i');
    } catch {
        return null;
    }
}

// Map homoglyphs to ascii and lowercase, but KEEP separators so the regex
// (which allows separators between letters) can still see the structure.
function normalize(text) {
    let out = '';
    for (const ch of String(text).slice(0, 1000)) out += (CONFUSABLES[ch] || ch);
    return out.toLowerCase();
}

/**
 * Scan text. Returns one of:
 *   { status: 'clean' }
 *   { status: 'blocked', word }   definite hit (regex matched a whole word)
 *   { status: 'suspect', word }   collapsed text contains it but boundaries
 *                                 are fuzzy -> let the AI decide
 */
function scan(text) {
    const norm = normalize(text);
    const deleet = applyDeleet(norm);
    const cNorm = norm.replace(/[\W_]/g, '');
    const cDeleet = deleet.replace(/[\W_]/g, '');
    let suspect = null;
    for (const w of WORDS) {
        // Cheap prefilter: is the word present once separators are removed,
        // either as-is or after undoing leetspeak?
        if (!cNorm.includes(w) && !cDeleet.includes(w)) continue;
        const rx = WORD_REGEX.get(w);
        if (rx && (rx.test(norm) || rx.test(deleet))) return { status: 'blocked', word: w };
        suspect = w; // present but boundaries fuzzy -> let the AI decide
    }
    return suspect ? { status: 'suspect', word: suspect } : { status: 'clean' };
}

async function askAI(content, suspectWord) {
    const model = getModel();
    if (!model) return false;
    try {
        const prompt =
            'You are a strict Discord moderation filter. Reply with ONLY "YES" or "NO". ' +
            'Is the following message trying to say or disguise the banned word "' + suspectWord +
            '" (using spacing, symbols, or lookalike characters)? Message: "' + content.slice(0, 300) + '"';
        const res = await model.generateContent(prompt);
        return /\byes\b/i.test((await res.response).text());
    } catch {
        return false;
    }
}

async function punish(message) {
    await message.delete().catch(() => null);
    const warn = await message.channel.send({
        content: '🚫 ' + message.author.toString() + ', your message was removed for a filtered word.',
        allowedMentions: { users: [message.author.id] }
    }).catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => null), 5000);
}

/** Called from index.js on every message. Returns true if it acted. */
async function checkMessage(message, client) {
    if (!message.guild || !message.content) return false;
    const cfg = await FilterConfig.findOne({ guildId: message.guildId }).catch(() => null);
    if (!cfg || !cfg.enabled) return false;
    // Don't filter people who can already moderate.
    if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;
    if (!WORDS.length) loadWords();

    const result = scan(message.content);
    if (result.status === 'blocked') { await punish(message); return true; }
    if (result.status === 'suspect' && cfg.useAI) {
        if (await askAI(message.content, result.word)) { await punish(message); return true; }
    }
    return false;
}

// Load words at startup.
loadWords();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Turn the word filter on/off and manage it')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(s => s.setName('enable').setDescription('Turn the word filter ON'))
        .addSubcommand(s => s.setName('disable').setDescription('Turn the word filter OFF'))
        .addSubcommand(s => s.setName('status').setDescription('Show the current filter status'))
        .addSubcommand(s => s.setName('ai').setDescription('Toggle the Gemini AI fallback')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
        .addSubcommand(s => s.setName('add').setDescription('Add a word to the filter')
            .addStringOption(o => o.setName('word').setDescription('Word to ban').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove a word from the filter')
            .addStringOption(o => o.setName('word').setDescription('Word to unban').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Show how many words are filtered'))
        .addSubcommand(s => s.setName('test').setDescription('Test the filter against sample text')
            .addStringOption(o => o.setName('text').setDescription('Text to test').setRequired(true))),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Server only.', ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        const cfg = await FilterConfig.findOne({ guildId: interaction.guildId })
            || new FilterConfig({ guildId: interaction.guildId });

        if (sub === 'enable') {
            cfg.enabled = true; await cfg.save();
            return interaction.reply({ content: `✅ Word filter **enabled**. Watching for ${WORDS.length} words (bypass-resistant).`, ephemeral: true });
        }
        if (sub === 'disable') {
            cfg.enabled = false; await cfg.save();
            return interaction.reply({ content: '🛑 Word filter **disabled**.', ephemeral: true });
        }
        if (sub === 'ai') {
            cfg.useAI = interaction.options.getBoolean('enabled'); await cfg.save();
            return interaction.reply({ content: `🤖 AI fallback is now **${cfg.useAI ? 'ON' : 'OFF'}**.`, ephemeral: true });
        }
        if (sub === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Word Filter Status')
                .setColor(cfg.enabled ? '#22c55e' : '#ef4444')
                .addFields(
                    { name: 'Filter', value: cfg.enabled ? '✅ Enabled' : '🛑 Disabled', inline: true },
                    { name: 'AI fallback', value: cfg.useAI ? '🤖 On' : 'Off', inline: true },
                    { name: 'Words loaded', value: String(WORDS.length), inline: true },
                    { name: 'Confusable chars mapped', value: String(Object.keys(CONFUSABLES).length), inline: true }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (sub === 'add') {
            const word = interaction.options.getString('word').toLowerCase().trim();
            if (WORDS.includes(word)) return interaction.reply({ content: '⚠️ That word is already filtered.', ephemeral: true });
            WORDS.push(word); saveWords(); loadWords();
            return interaction.reply({ content: `✅ Added \`${word}\`. Now filtering ${WORDS.length} words.`, ephemeral: true });
        }
        if (sub === 'remove') {
            const word = interaction.options.getString('word').toLowerCase().trim();
            if (!WORDS.includes(word)) return interaction.reply({ content: '⚠️ That word is not in the list.', ephemeral: true });
            WORDS = WORDS.filter((w) => w !== word); saveWords(); loadWords();
            return interaction.reply({ content: `🗑️ Removed \`${word}\`. Now filtering ${WORDS.length} words.`, ephemeral: true });
        }
        if (sub === 'list') {
            const preview = WORDS.slice(0, 30).join(', ');
            return interaction.reply({ content: `📋 **${WORDS.length}** words filtered.\nFirst 30: ${preview || '(none)'}`, ephemeral: true });
        }
        if (sub === 'test') {
            const text = interaction.options.getString('text');
            const r = scan(text);
            const label = r.status === 'blocked' ? `🚫 BLOCKED (matched \`${r.word}\`)`
                : r.status === 'suspect' ? `🤔 SUSPECT (looks like \`${r.word}\` — AI would decide)`
                    : '✅ CLEAN';
            return interaction.reply({ content: `Result: ${label}\nNormalized: \`${normalize(text).slice(0, 200)}\``, ephemeral: true });
        }
    },

    // Exposed for index.js + tests.
    checkMessage,
    scan,
    normalize,
    buildWordRegex,
    loadWords
};

/*__DOCS__*/

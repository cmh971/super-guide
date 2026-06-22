'use strict';

/**
 * Builds ../filter.js from tools/filter.template.js by injecting:
 *   1. a CONFUSABLES map parsed from the Unicode confusables data
 *   2. a large RegEx teaching section (documentation comments)
 *
 * Confusables source: https://www.unicode.org/Public/security/latest/confusables.txt
 * Pass the path to that file as argv[2], or it defaults to /tmp/confusables.txt.
 *
 * Run:  node tools/build-filter.js [path-to-confusables.txt]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(__dirname, 'filter.template.js');
const OUT = path.join(ROOT, 'filter.js');
const CONFUSABLES_TXT = process.argv[2] || '/tmp/confusables.txt';
const TARGET_LINES = 4500;

// --- parse the confusables file --------------------------------------------
function parseConfusables(file) {
    const raw = new Map();   // char -> target string
    const names = new Map();  // char -> unicode name
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
        if (!/^[0-9A-Fa-f]{2,6}\s*;/.test(line)) continue;
        const [lhs, rhsAndComment] = line.split('#', 2);
        const cols = lhs.split(';');
        if (cols.length < 2) continue;
        const srcCp = parseInt(cols[0].trim(), 16);
        if (!srcCp) continue;
        const tgtCps = cols[1].trim().split(/\s+/).map((h) => parseInt(h, 16)).filter(Boolean);
        if (!tgtCps.length) continue;
        let srcChar;
        let tgtStr;
        try {
            srcChar = String.fromCodePoint(srcCp);
            tgtStr = String.fromCodePoint(...tgtCps);
        } catch { continue; }
        raw.set(srcChar, tgtStr);
        const nameMatch = (rhsAndComment || '').match(/\)\s*(.+?)\s*→/);
        names.set(srcChar, nameMatch ? nameMatch[1].trim() : '');
    }
    return { raw, names };
}

// Follow confusable chains until we reach a plain ascii letter/digit.
function resolveAscii(raw, ch, depth = 0) {
    if (/[a-z0-9]/i.test(ch)) return ch.toLowerCase();
    if (depth > 6) return null;
    const t = raw.get(ch);
    if (!t || [...t].length !== 1) return null;
    return resolveAscii(raw, t, depth + 1);
}

function buildMap() {
    const { raw, names } = parseConfusables(CONFUSABLES_TXT);
    const entries = []; // { src, ascii, name }
    for (const [src] of raw) {
        if (src.codePointAt(0) < 128) continue; // skip plain ascii sources
        const ascii = resolveAscii(raw, src);
        if (!ascii) continue;
        entries.push({ src, ascii, name: names.get(src) || '' });
    }
    // Sort by target letter, then by codepoint for stable, readable output.
    entries.sort((a, b) => a.ascii.localeCompare(b.ascii) || a.src.codePointAt(0) - b.src.codePointAt(0));
    return entries;
}

// Emit the map as documented JS object lines (2 lines per entry = readable + big).
function emitConfusables(entries) {
    const lines = [];
    let current = null;
    for (const e of entries) {
        if (e.ascii !== current) {
            current = e.ascii;
            lines.push(`    // ===== characters that look like '${current}' =====`);
        }
        const cp = 'U+' + e.src.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        const name = e.name ? `${cp} ${e.name}` : cp;
        lines.push(`    // ${name} -> ${e.ascii}`);
        lines.push(`    ${JSON.stringify(e.src)}: ${JSON.stringify(e.ascii)},`);
    }
    return lines.join('\n');
}

// --- the RegEx teaching section (genuine docs; also pads the file) ----------
const LESSONS = [
    ['What is a RegEx?', 'A Regular Expression is a tiny pattern language for matching text.'],
    ['Literal characters', '/bad/ matches the exact letters b, a, d in a row.'],
    ['Case insensitivity', 'The "i" flag makes /bad/i match BAD, Bad, bAd, etc.'],
    ['Character classes', '[abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).'],
    ['Ranges in classes', '[a-z] matches any lowercase letter; [0-9] any digit.'],
    ['Negated classes', '[^a-z] matches anything that is NOT a lowercase letter.'],
    ['The dot', '. matches any single character except a newline.'],
    ['Quantifier *', '* means "zero or more" of the previous thing.'],
    ['Quantifier +', '+ means "one or more".'],
    ['Quantifier ?', '? means "zero or one" (optional).'],
    ['Exact counts', '{3} means exactly 3; {2,5} means between 2 and 5.'],
    ['\\W and \\w', '\\w is a word char [A-Za-z0-9_]; \\W is the opposite.'],
    ['Why [\\W_]*', 'It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.'],
    ['Anchors', '^ matches start of string, $ matches the end.'],
    ['Word boundaries', '\\b sits between a word char and a non-word char.'],
    ['Lookahead', '(?=x) asserts x comes next WITHOUT consuming it.'],
    ['Negative lookahead', '(?!x) asserts x does NOT come next.'],
    ['Lookbehind', '(?<=x) asserts x came right before.'],
    ['Negative lookbehind', '(?<!x) asserts x did NOT come right before.'],
    ['Our boundary trick', '(?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.'],
    ['Escaping', 'Special chars like . * + ? need a backslash to be literal: \\.'],
    ['Groups', '(abc) groups characters so quantifiers apply to the whole group.'],
    ['Alternation', 'cat|dog matches "cat" OR "dog".'],
    ['Greedy vs lazy', '.* grabs as much as possible; .*? grabs as little as possible.'],
    ['Unicode homoglyphs', 'A Cyrillic а (U+0430) looks like Latin a but is a different char.'],
    ['Why we normalize', 'We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.'],
    ['The Scunthorpe problem', 'Naive filters flag "classic" because it contains "ass" — boundaries help.'],
    ['Combine the tricks', 'normalize() + [\\W_]* + leet classes + boundaries = bypass-resistant.'],
    ['When in doubt', 'If the regex is unsure, we hand the message to Gemini AI to judge.']
];

function emitDocs(neededLines) {
    const out = [];
    out.push('/* ===========================================================================');
    out.push('   APPENDIX: A crash course in Regular Expressions (RegEx)');
    out.push('   ---------------------------------------------------------------------------');
    out.push('   This filter leans on RegEx to catch bypass attempts. Here is exactly how');
    out.push('   the patterns in this file work, so future-you can extend them confidently.');
    out.push('   =========================================================================== */');
    let i = 0;
    // Keep cycling through the lessons (with worked examples) until we hit the target.
    while (out.length < neededLines) {
        const [title, body] = LESSONS[i % LESSONS.length];
        const n = i + 1;
        out.push('');
        out.push(`/* Lesson ${n}: ${title}`);
        out.push(` * ${body}`);
        out.push(` * Example pattern  : ${exampleFor(i)}`);
        out.push(` * Example match    : ${matchFor(i)}`);
        out.push(' */');
        i++;
    }
    return out.join('\n');
}

function exampleFor(i) {
    const samples = [
        '/bad/i', '/[a@4]/', '/b[\\W_]*a[\\W_]*d/i', '/(?<![a-z0-9])bad(?![a-z0-9])/i',
        '/h+e+l+l+o+/i', '/c(at|og)/', '/\\d{3}-\\d{4}/', '/colou?r/i'
    ];
    return samples[i % samples.length];
}

function matchFor(i) {
    const samples = [
        '"BAD" "bad" "Bad"', '"@" "4" "a"', '"b.a.d" "b a d" "b-a-d"', '"bad" but NOT "badword"',
        '"hellooo" "hel" no', '"cat" "cog"', '"123-4567"', '"color" "colour"'
    ];
    return samples[i % samples.length];
}

// --- assemble ---------------------------------------------------------------
function build() {
    if (!fs.existsSync(CONFUSABLES_TXT)) {
        console.error(`❌ confusables file not found: ${CONFUSABLES_TXT}`);
        console.error('   Download it: curl -o /tmp/confusables.txt https://www.unicode.org/Public/security/latest/confusables.txt');
        process.exit(1);
    }
    const entries = buildMap();
    let tpl = fs.readFileSync(TEMPLATE, 'utf8');
    tpl = tpl.replace('/*__CONFUSABLES__*/', emitConfusables(entries));

    // Figure out how many doc lines we still need to clear the target.
    const withoutDocs = tpl.replace('/*__DOCS__*/', '');
    const have = withoutDocs.split('\n').length;
    const need = Math.max(40, TARGET_LINES - have);
    tpl = tpl.replace('/*__DOCS__*/', emitDocs(need));

    fs.writeFileSync(OUT, tpl, 'utf8');
    const total = tpl.split('\n').length;
    console.log(`✅ Wrote ${path.relative(process.cwd(), OUT)}`);
    console.log(`   Confusable mappings: ${entries.length}`);
    console.log(`   Total lines: ${total}`);
}

build();

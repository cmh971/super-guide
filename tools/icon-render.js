// tools/icon-render.js
// Defines the 40 Kansas State Roleplay badge icons as SVG, writes them to
// assets/icons/*.svg (the editable source of truth), and rasterises them to PNG
// on demand via our own tools/svg2png converter (Discord emojis must be PNG/GIF).
//
// Exports:
//   ICONS        – [{ name, label, color, file }]  metadata, one per icon
//   buildSvg(i)  – returns the SVG string for ICONS[i]
//   getSvg(i)    – reads ICONS[i] from disk if present, else buildSvg(i)
//   render(i)    – PNG Buffer for ICONS[i]
//   writeAll()   – (re)writes every .svg file + manifest.json to assets/icons

const fs = require('node:fs');
const path = require('node:path');
const { svgToPng } = require('./svg2png');

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');

/* ---- design-space helpers: 0..100 -> badge inner area (20..108 px) ---- */
const m = v => +(20 + (v / 100) * 88).toFixed(2);
const r = v => +((v / 100) * 88).toFixed(2);
const ptsStr = arr => arr.map(([x, y]) => `${m(x)},${m(y)}`).join(' ');

function starPts(cx, cy, outer, inner, spikes) {
    const out = [];
    for (let i = 0; i < spikes * 2; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / spikes;
        const rad = i % 2 === 0 ? outer : inner;
        out.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    return out;
}
function ngonPts(cx, cy, rad, n, rot = -Math.PI / 2) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const ang = rot + (i * 2 * Math.PI) / n;
        out.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    return out;
}

const FG = '#ffffff';
const poly = p => `<polygon points="${ptsStr(p)}" fill="${FG}"/>`;
const rect = (x, y, w, h) => `<rect x="${m(x)}" y="${m(y)}" width="${r(w)}" height="${r(h)}" fill="${FG}"/>`;
const circ = (cx, cy, rad) => `<circle cx="${m(cx)}" cy="${m(cy)}" r="${r(rad)}" fill="${FG}"/>`;
const ringEl = (cx, cy, rad, w) => `<circle cx="${m(cx)}" cy="${m(cy)}" r="${r(rad)}" fill="none" stroke="${FG}" stroke-width="${r(w)}"/>`;

// Each symbol returns the inner SVG markup drawn on top of the badge.
const SYMBOLS = {
    disc:     () => circ(50, 50, 34),
    ring:     () => ringEl(50, 50, 28, 12),
    dot3:     () => circ(28, 50, 10) + circ(50, 50, 10) + circ(72, 50, 10),
    square:   () => poly([[28, 28], [72, 28], [72, 72], [28, 72]]),
    diamond:  () => poly([[50, 16], [84, 50], [50, 84], [16, 50]]),
    triUp:    () => poly([[50, 20], [84, 80], [16, 80]]),
    triDown:  () => poly([[16, 22], [84, 22], [50, 82]]),
    hexagon:  () => poly(ngonPts(50, 50, 38, 6)),
    pentagon: () => poly(ngonPts(50, 52, 38, 5)),
    star5:    () => poly(starPts(50, 52, 40, 17, 5)),
    star6:    () => poly(starPts(50, 50, 40, 18, 6)),
    plus:     () => rect(42, 22, 16, 56) + rect(22, 42, 56, 16),
    cross:    () => poly([[28, 20], [40, 20], [80, 60], [80, 72], [68, 72], [28, 32]]) +
                    poly([[72, 20], [80, 20], [80, 32], [40, 72], [28, 72], [28, 60]]),
    heart:    () => poly([[50, 34], [58, 24], [72, 24], [80, 36], [78, 50], [50, 82], [22, 50], [20, 36], [28, 24], [42, 24]]),
    bolt:     () => poly([[56, 16], [30, 56], [48, 56], [42, 84], [74, 40], [54, 40]]),
    shield:   () => poly([[24, 28], [50, 20], [76, 28], [76, 52], [50, 86], [24, 52]]),
    lock:     () => ringEl(50, 46, 13, 7) + rect(34, 52, 32, 34),
    check:    () => poly([[28, 52], [42, 66], [76, 28], [84, 36], [44, 80], [20, 56]]),
    bars3:    () => rect(28, 32, 44, 10) + rect(28, 50, 44, 10) + rect(28, 68, 44, 10),
    chart:    () => rect(26, 56, 14, 24) + rect(43, 40, 14, 40) + rect(60, 26, 14, 54),
};

const GRADIENTS = [
    ['#60a5fa', '#2563eb', 'blue'],   ['#34d399', '#059669', 'green'],
    ['#f87171', '#dc2626', 'red'],    ['#fbbf24', '#d97706', 'amber'],
    ['#a78bfa', '#7c3aed', 'violet'], ['#f472b6', '#db2777', 'pink'],
    ['#22d3ee', '#0891b2', 'cyan'],   ['#fb923c', '#ea580c', 'orange'],
    ['#4ade80', '#16a34a', 'lime'],   ['#818cf8', '#4f46e5', 'indigo'],
    ['#2dd4bf', '#0d9488', 'teal'],   ['#e879f9', '#c026d3', 'fuchsia'],
];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const SYMBOL_KEYS = Object.keys(SYMBOLS); // 20

const ICONS = [];
for (let variant = 0; variant < 2; variant++) {
    for (let s = 0; s < SYMBOL_KEYS.length; s++) {
        const key = SYMBOL_KEYS[s];
        const grad = GRADIENTS[(s + variant * SYMBOL_KEYS.length) % GRADIENTS.length];
        const name = `ksrp_${grad[2]}_${key}`.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
        ICONS.push({
            name,
            label: `${cap(grad[2])} ${cap(key)}`,
            color: parseInt(grad[1].slice(1), 16),
            file: `${name}.svg`,
            _grad: grad,
            _sym: key,
        });
    }
}

function buildSvg(i) {
    const ic = ICONS[i];
    if (!ic) throw new RangeError(`icon index ${i} out of range`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${ic.label} — Kansas State Roleplay icon. Rasterised by tools/svg2png.js -->
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${ic._grad[0]}"/>
      <stop offset="1" stop-color="${ic._grad[1]}"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)"/>
  ${SYMBOLS[ic._sym]()}
</svg>
`;
}

function getSvg(i) {
    const ic = ICONS[i];
    const p = path.join(ICONS_DIR, ic.file);
    try { return fs.readFileSync(p, 'utf8'); } catch { return buildSvg(i); }
}

function render(i) { return svgToPng(getSvg(i)); }

function writeAll() {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    for (let i = 0; i < ICONS.length; i++) fs.writeFileSync(path.join(ICONS_DIR, ICONS[i].file), buildSvg(i));
    const manifest = ICONS.map(({ name, label, color, file }) => ({ name, label, color, file }));
    fs.writeFileSync(path.join(ICONS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return ICONS.length;
}

module.exports = { ICONS, buildSvg, getSvg, render, writeAll, ICONS_DIR };

// `node tools/icon-render.js` regenerates the .svg files.
if (require.main === module) console.log(`Wrote ${writeAll()} icons to ${ICONS_DIR}`);

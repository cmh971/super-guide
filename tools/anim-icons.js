// tools/anim-icons.js
// 11 animated badge icons for Kansas State Roleplay, rendered frame-by-frame on
// a tiny software canvas and encoded as animated GIFs via tools/gif.js (Discord
// animated emojis must be GIF). Solid badge backgrounds keep the GIF palette
// small so the files stay well under Discord's 256 KB emoji limit.
//
// Exports:
//   ANIMS       – [{ name, label, color }]
//   renderGif(i)– animated GIF Buffer for ANIMS[i]
//   writeAll()  – write every .gif to assets/animated + manifest.json

const fs = require('node:fs');
const path = require('node:path');
const { encodeGIF } = require('./gif');

const SIZE = 128;
const WHITE = [255, 255, 255];
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const TAU = Math.PI * 2;

class Canvas {
    constructor() { this.d = new Uint8Array(SIZE * SIZE * 4); }
    blend(x, y, c, a) {
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return;
        const i = (y * SIZE + x) * 4;
        const da = this.d[i + 3] / 255, oa = a + da * (1 - a);
        if (oa <= 0) return;
        this.d[i]     = (c[0] * a + this.d[i]     * da * (1 - a)) / oa;
        this.d[i + 1] = (c[1] * a + this.d[i + 1] * da * (1 - a)) / oa;
        this.d[i + 2] = (c[2] * a + this.d[i + 2] * da * (1 - a)) / oa;
        this.d[i + 3] = oa * 255;
    }
    // Solid rounded-square badge background (matches the static icon shape).
    bg(col) {
        const cx = 64, cy = 64, hw = 60, hh = 60, r = 28;
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const qx = Math.abs(x + 0.5 - cx) - (hw - r);
            const qy = Math.abs(y + 0.5 - cy) - (hh - r);
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
            const cov = clamp01(0.5 - sd);
            if (cov > 0) this.blend(x, y, col, cov);
        }
    }
    disc(cx, cy, rad, col) { this.ellipse(cx, cy, rad, rad, col); }
    ellipse(cx, cy, rx, ry, col) {
        if (rx <= 0 || ry <= 0) return;
        const x0 = Math.max(0, Math.floor(cx - rx - 1)), x1 = Math.min(SIZE - 1, Math.ceil(cx + rx + 1));
        const y0 = Math.max(0, Math.floor(cy - ry - 1)), y1 = Math.min(SIZE - 1, Math.ceil(cy + ry + 1));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            let hits = 0;
            for (const sx of [0.25, 0.75]) for (const sy of [0.25, 0.75]) {
                const dx = (x + sx - cx) / rx, dy = (y + sy - cy) / ry;
                if (dx * dx + dy * dy <= 1) hits++;
            }
            if (hits) this.blend(x, y, col, hits / 4);
        }
    }
    arc(cx, cy, rad, thick, col, a0, len) {
        const R = rad + thick;
        const x0 = Math.max(0, Math.floor(cx - R - 1)), x1 = Math.min(SIZE - 1, Math.ceil(cx + R + 1));
        const y0 = Math.max(0, Math.floor(cy - R - 1)), y1 = Math.min(SIZE - 1, Math.ceil(cy + R + 1));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            let hits = 0;
            for (const sx of [0.25, 0.75]) for (const sy of [0.25, 0.75]) {
                const dist = Math.hypot(x + sx - cx, y + sy - cy);
                if (Math.abs(dist - rad) > thick / 2) continue;
                let ang = Math.atan2(y + sy - cy, x + sx - cx) - a0;
                ang = ((ang % TAU) + TAU) % TAU;
                if (ang <= len) hits++;
            }
            if (hits) this.blend(x, y, col, hits / 4);
        }
    }
    ring(cx, cy, rad, thick, col) { this.arc(cx, cy, rad, thick, col, 0, TAU); }
    poly(pts, col) {
        let minX = SIZE, minY = SIZE, maxX = 0, maxY = 0;
        for (const [px, py] of pts) { if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
        minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
        maxX = Math.min(SIZE - 1, Math.ceil(maxX)); maxY = Math.min(SIZE - 1, Math.ceil(maxY));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            let hits = 0;
            for (const sx of [0.25, 0.75]) for (const sy of [0.25, 0.75]) if (inPoly(x + sx, y + sy, pts)) hits++;
            if (hits) this.blend(x, y, col, hits / 4);
        }
    }
    rect(x, y, w, h, col) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col); }
    rgba() { return this.d; }
}

function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}
function rot(pts, cx, cy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
function starPts(cx, cy, outer, inner, spikes, rotation = -Math.PI / 2) {
    const out = [];
    for (let i = 0; i < spikes * 2; i++) {
        const ang = rotation + (i * Math.PI) / spikes;
        const r = i % 2 === 0 ? outer : inner;
        out.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
    }
    return out;
}
const heartPts = (cx, cy, s) => [
    [0, 8], [16, -10], [40, -10], [56, 12], [52, 38], [0, 80], [-52, 38], [-56, 12], [-40, -10], [-16, -10],
].map(([x, y]) => [cx + x * s, cy + y * s]);

// Each animation draws one frame for phase t in [0,1).
const ANIMS = [
    { name: 'ksrp_anim_spinner',  label: 'Blue Spinner',     color: 0x2563eb, bg: [37, 99, 235],  frames: 16, delay: 70,
      draw: (c, t) => { c.arc(64, 64, 30, 9, WHITE, t * TAU, TAU * 0.3); } },
    { name: 'ksrp_anim_pulse',    label: 'Green Pulse',       color: 0x059669, bg: [5, 150, 105],  frames: 16, delay: 60,
      draw: (c, t) => { const s = 0.72 + 0.18 * Math.sin(t * TAU); c.poly(heartPts(64, 58, s), WHITE); } },
    { name: 'ksrp_anim_bounce',   label: 'Red Bounce',        color: 0xdc2626, bg: [220, 38, 38],  frames: 16, delay: 55,
      draw: (c, t) => { const h = Math.abs(Math.sin(Math.PI * t)); c.disc(64, 92 - 48 * h, 13, WHITE); } },
    { name: 'ksrp_anim_dots',     label: 'Amber Dots',        color: 0xd97706, bg: [217, 119, 6],  frames: 18, delay: 60,
      draw: (c, t) => { for (let i = 0; i < 3; i++) { const p = 0.5 + 0.5 * Math.sin((t - i / 3) * TAU); c.disc(40 + i * 24, 64, 6 + 6 * p, WHITE); } } },
    { name: 'ksrp_anim_spin',     label: 'Violet Spin',       color: 0x7c3aed, bg: [124, 58, 237], frames: 16, delay: 70,
      draw: (c, t) => { c.poly(rot([[40, 40], [88, 40], [88, 88], [40, 88]], 64, 64, t * (Math.PI / 2)), WHITE); } },
    { name: 'ksrp_anim_radar',    label: 'Cyan Radar',        color: 0x0891b2, bg: [8, 145, 178],  frames: 16, delay: 70,
      draw: (c, t) => { c.disc(64, 64, 6, WHITE); c.ring(64, 64, 8 + 32 * t, Math.max(2, 7 * (1 - t)), WHITE); } },
    { name: 'ksrp_anim_sparkle',  label: 'Pink Sparkle',      color: 0xdb2777, bg: [219, 39, 119], frames: 16, delay: 60,
      draw: (c, t) => { const s = 0.78 + 0.22 * Math.sin(t * TAU); c.poly(starPts(64, 64, 40 * s, 17 * s, 5), WHITE); } },
    { name: 'ksrp_anim_wave',     label: 'Orange Equalizer',  color: 0xea580c, bg: [234, 88, 12],  frames: 18, delay: 55,
      draw: (c, t) => { for (let i = 0; i < 3; i++) { const h = 22 + 22 * (0.5 + 0.5 * Math.sin((t + i / 4) * TAU)); c.rect(40 + i * 18, 64 - h / 2, 12, h, WHITE); } } },
    { name: 'ksrp_anim_coin',     label: 'Indigo Coin',       color: 0x4f46e5, bg: [79, 70, 229],  frames: 16, delay: 65,
      draw: (c, t) => { const rx = Math.abs(Math.cos(t * TAU)) * 33 + 1.5; c.ellipse(64, 64, rx, 33, WHITE); } },
    { name: 'ksrp_anim_progress', label: 'Teal Progress',     color: 0x0d9488, bg: [13, 148, 136], frames: 16, delay: 65,
      draw: (c, t) => { c.arc(64, 64, 30, 9, WHITE, -Math.PI / 2, Math.max(0.001, TAU * t)); } },
    { name: 'ksrp_anim_loading',  label: 'Fuchsia Loading',   color: 0xc026d3, bg: [192, 38, 211], frames: 16, delay: 60,
      draw: (c, t) => { c.rect(30, 58, 68, 4, WHITE); c.rect(30, 74, 68, 4, WHITE); c.rect(26, 56, 4, 20, WHITE); c.rect(98, 56, 4, 20, WHITE); c.rect(30, 58, 68 * t, 20, WHITE); } },
];

function renderGif(i) {
    const a = ANIMS[i];
    if (!a) throw new RangeError(`anim index ${i} out of range`);
    const frames = [];
    for (let f = 0; f < a.frames; f++) {
        const c = new Canvas();
        c.bg(a.bg);
        a.draw(c, f / a.frames);
        frames.push({ rgba: c.rgba(), delayMs: a.delay });
    }
    return encodeGIF({ width: SIZE, height: SIZE, frames, loop: 0 });
}

function writeAll() {
    const dir = path.join(__dirname, '..', 'assets', 'animated');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < ANIMS.length; i++) fs.writeFileSync(path.join(dir, `${ANIMS[i].name}.gif`), renderGif(i));
    fs.writeFileSync(path.join(dir, 'manifest.json'),
        JSON.stringify(ANIMS.map(({ name, label, color }) => ({ name, label, color, file: `${name}.gif` })), null, 2));
    return ANIMS.length;
}

module.exports = {
    ANIMS: ANIMS.map(({ name, label, color }) => ({ name, label, color })),
    renderGif,
    writeAll,
};

if (require.main === module) console.log(`Wrote ${writeAll()} animated icons`);

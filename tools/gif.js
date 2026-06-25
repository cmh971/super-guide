// tools/gif.js
// Dependency-free animated GIF89a encoder (with GIF-variant LZW), hand-written
// so the bot can build ANIMATED custom emojis (Discord requires GIF for those).
//
// encodeGIF({ width, height, frames:[{ rgba, delayMs }], loop }) -> Buffer
//   rgba   : Uint8Array/Buffer of width*height*4 (straight alpha; a<128 = transparent)
//   delayMs: per-frame delay in milliseconds
//   loop   : 0 = loop forever (default)

/* ----------------------------- LZW ----------------------------- */
// Standard GIF LZW. Validated by round-tripping through a real GIF decoder
// (we render the output as an image to confirm it's spec-compliant).
function lzwEncode(minCode, indices) {
    const CLEAR = 1 << minCode;
    const EOI = CLEAR + 1;
    let codeSize = minCode + 1;
    let dict = new Map();
    let next;

    const reset = () => {
        dict = new Map();
        for (let i = 0; i < CLEAR; i++) dict.set(`${i}`, i);
        next = EOI + 1;
        codeSize = minCode + 1;
    };

    const out = [];
    let acc = 0, nbits = 0;
    const write = code => {
        acc |= code << nbits;
        nbits += codeSize;
        while (nbits >= 8) { out.push(acc & 0xff); acc >>= 8; nbits -= 8; }
    };

    reset();
    write(CLEAR);

    let buffer = `${indices[0]}`;
    for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const combined = `${buffer},${k}`;
        if (dict.has(combined)) {
            buffer = combined;
        } else {
            write(dict.get(buffer));
            // Grow the code size BEFORE assigning the next code, matching the
            // canonical GIF encoder (giflib/LZWEncoder): bump when the count of
            // defined codes has reached 2^codeSize. Doing this after the
            // assignment (next===2^codeSize) bumps one code too early and
            // desyncs standard decoders.
            if (next < 4096) {
                if (next >= (1 << codeSize) && codeSize < 12) codeSize++;
                dict.set(combined, next++);
            } else {
                write(CLEAR);
                reset();
            }
            buffer = `${k}`;
        }
    }
    write(dict.get(buffer));
    write(EOI);
    if (nbits > 0) out.push(acc & 0xff);
    return out;
}

/* ------------------------- byte helpers ------------------------- */
function u16(v) { return [v & 0xff, (v >> 8) & 0xff]; }

// Split LZW bytes into <=255-byte sub-blocks, each prefixed by its length.
function subBlocks(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 255) {
        const part = bytes.slice(i, i + 255);
        out.push(part.length, ...part);
    }
    out.push(0); // block terminator
    return out;
}

/* ------------------------- palette build ------------------------ */
// Index 0 is reserved as the transparent colour. Opaque pixel colours are
// collected; if there are >255 of them they're quantised down by dropping
// low bits until they fit.
function buildPalette(frames) {
    for (let bits = 0; bits <= 5; bits++) {
        const mask = (0xff << bits) & 0xff;
        const q = c => (bits ? (c & mask) : c);
        const map = new Map();
        const palette = [[0, 0, 0]]; // index 0 = transparent
        let overflow = false;
        for (const f of frames) {
            for (let p = 0; p < f.rgba.length; p += 4) {
                if (f.rgba[p + 3] < 128) continue;
                const r = q(f.rgba[p]), g = q(f.rgba[p + 1]), b = q(f.rgba[p + 2]);
                const key = (r << 16) | (g << 8) | b;
                if (!map.has(key)) {
                    if (palette.length >= 256) { overflow = true; break; }
                    map.set(key, palette.length);
                    palette.push([r, g, b]);
                }
            }
            if (overflow) break;
        }
        if (!overflow) return { palette, mask, bits };
    }
    throw new Error('gif: could not fit palette into 256 colours');
}

function indexFrame(rgba, palette, mask, bits) {
    const q = c => (bits ? (c & mask) : c);
    // exact lookup table for speed
    const lut = new Map();
    for (let i = 1; i < palette.length; i++) lut.set((palette[i][0] << 16) | (palette[i][1] << 8) | palette[i][2], i);
    const n = rgba.length / 4;
    const idx = new Uint8Array(n);
    for (let p = 0, j = 0; j < n; j++, p += 4) {
        if (rgba[p + 3] < 128) { idx[j] = 0; continue; }
        const key = (q(rgba[p]) << 16) | (q(rgba[p + 1]) << 8) | q(rgba[p + 2]);
        idx[j] = lut.get(key) ?? 1;
    }
    return idx;
}

/* --------------------------- encoder ---------------------------- */
function encodeGIF({ width, height, frames, loop = 0 }) {
    const { palette, mask, bits } = buildPalette(frames);

    // Global Colour Table size must be a power of two (>= palette length).
    let gctBitsMinus1 = 0;
    while ((1 << (gctBitsMinus1 + 1)) < palette.length) gctBitsMinus1++;
    const gctSize = 1 << (gctBitsMinus1 + 1);
    const minCode = Math.max(2, gctBitsMinus1 + 1);

    const bytes = [];
    const push = (...b) => bytes.push(...b);

    // Header + Logical Screen Descriptor
    push(...[...'GIF89a'].map(c => c.charCodeAt(0)));
    push(...u16(width), ...u16(height));
    push(0x80 | (gctBitsMinus1 << 4) | gctBitsMinus1, 0, 0); // GCT present, sized

    // Global Colour Table
    for (let i = 0; i < gctSize; i++) {
        const c = palette[i] || [0, 0, 0];
        push(c[0], c[1], c[2]);
    }

    // NETSCAPE2.0 looping extension
    push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 0x03, 0x01, ...u16(loop), 0x00);

    for (const f of frames) {
        const delay = Math.round((f.delayMs ?? 80) / 10); // GIF delay is in 1/100s
        // Graphic Control Extension (disposal=2 restore-to-bg, transparent idx 0)
        push(0x21, 0xf9, 0x04, 0x08 | 0x01, ...u16(delay), 0x00, 0x00);
        // Image Descriptor (no local colour table)
        push(0x2c, ...u16(0), ...u16(0), ...u16(width), ...u16(height), 0x00);
        // Image data (pushed iteratively — a frame can be larger than the
        // spread-arguments limit).
        const idx = indexFrame(f.rgba, palette, mask, bits);
        push(minCode);
        const blocks = subBlocks(lzwEncode(minCode, idx));
        for (let i = 0; i < blocks.length; i++) bytes.push(blocks[i]);
    }

    push(0x3b); // trailer
    return Buffer.from(bytes);
}

module.exports = { encodeGIF };

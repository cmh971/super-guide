// ============================================================================
// tools/svg2png.js
// ----------------------------------------------------------------------------
// California State Roleplay — SVG → PNG Rasteriser
//
// Hand-written, dependency-light renderer so the bot can:
//
//   • Store icons as editable SVG
//   • Render them to PNG buffers for Discord emojis
//
// Supported primitives (extended):
//   • <svg viewBox>
//   • <defs><linearGradient><stop>
//   • <defs><radialGradient><stop>          (NEW)
//   • <rect> with rx, solid/gradient fill
//   • <circle> solid fill or stroke ring
//   • <ellipse>                             (NEW)
//   • <polygon> solid fill
//   • <line>                                (NEW)
//   • <path> subset: M, L, H, V, Z          (NEW, simple polygons)
//
// Supported colors:
//   • #rgb, #rrggbb
//   • url(#gradientId)
//   • none / transparent
//
// Export:
//   svgToPng(svgString, size?, opts?) -> PNG Buffer
//
//   opts = {
//     debug?: boolean,          // log parsed elements
//     background?: string|null, // hex or null for transparent
//     scale?: number,           // override auto scale
//   }
//
// This is intentionally over‑documented and over‑engineered for clarity.
// ============================================================================

const zlib = require('node:zlib');

// ============================================================================
// PNG ENCODER
// ============================================================================

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

/** Compute CRC32 for a buffer. */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a PNG chunk. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encode RGBA Uint8Array into a PNG buffer. */
function encodePNG(rgba, W, H) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA

  const stride = W * 4;
  const raw = Buffer.alloc((stride + 1) * H);
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);

  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    src.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============================================================================
// MATH / COLOR HELPERS
// ============================================================================

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Parse #rgb or #rrggbb into [r,g,b]. */
function hexToRgb(h) {
  if (!h) return [0, 0, 0];
  h = h.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const v = parseInt(h, 16);
  if (Number.isNaN(v)) return [0, 0, 0];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Parse color string into [r,g,b] or null. */
function parseColor(v) {
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v[0] === '#') return hexToRgb(v);
  // Named colors not supported; icons only use hex.
  return null;
}

// ============================================================================
// CANVAS
// ============================================================================

class Canvas {
  constructor(W, H, scale, backgroundRgb = null) {
    this.W = W;
    this.H = H;
    this.s = scale; // viewBox units -> device px
    this.d = new Uint8Array(W * H * 4);

    if (backgroundRgb) {
      for (let i = 0; i < this.d.length; i += 4) {
        this.d[i] = backgroundRgb[0];
        this.d[i + 1] = backgroundRgb[1];
        this.d[i + 2] = backgroundRgb[2];
        this.d[i + 3] = 255;
      }
    }
  }

  /** Alpha blend a color at integer pixel (x,y). */
  blend(x, y, c, a) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H || a <= 0) return;
    const i = (y * this.W + x) * 4;
    const da = this.d[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.d[i] = (c[0] * a + this.d[i] * da * (1 - a)) / oa;
    this.d[i + 1] = (c[1] * a + this.d[i + 1] * da * (1 - a)) / oa;
    this.d[i + 2] = (c[2] * a + this.d[i + 2] * da * (1 - a)) / oa;
    this.d[i + 3] = oa * 255;
  }

  /** Rounded rectangle with per‑pixel color function. */
  roundedRect(ux, uy, uw, uh, urx, colorAt) {
    const s = this.s;
    const cx = (ux + uw / 2) * s;
    const cy = (uy + uh / 2) * s;
    const hw = (uw / 2) * s;
    const hh = (uh / 2) * s;
    const r = urx * s;

    const x0 = Math.max(0, Math.floor(cx - hw - 1));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + hw + 1));
    const y0 = Math.max(0, Math.floor(cy - hh - 1));
    const y1 = Math.min(this.H - 1, Math.ceil(cy + hh + 1));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx = Math.abs(x + 0.5 - cx) - (hw - r);
        const qy = Math.abs(y + 0.5 - cy) - (hh - r);
        const sd =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
          Math.min(Math.max(qx, qy), 0) -
          r;
        const cov = clamp01(0.5 - sd);
        if (cov > 0) {
          const col = colorAt((x + 0.5) / s, (y + 0.5) / s);
          this.blend(x, y, col, cov);
        }
      }
    }
  }

  /** Filled disc. */
  disc(ucx, ucy, ur, col) {
    const s = this.s;
    const cx = ucx * s;
    const cy = ucy * s;
    const rad = ur * s;

    const x0 = Math.max(0, Math.floor(cx - rad - 1));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + rad + 1));
    const y0 = Math.max(0, Math.floor(cy - rad - 1));
    const y1 = Math.min(this.H - 1, Math.ceil(cy + rad + 1));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cov = clamp01(
          0.5 - (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad)
        );
        if (cov > 0) this.blend(x, y, col, cov);
      }
    }
  }

  /** Ring stroke. */
  ring(ucx, ucy, ur, uw, col) {
    const s = this.s;
    const cx = ucx * s;
    const cy = ucy * s;
    const rad = ur * s;
    const half = (uw * s) / 2;
    const R = rad + half;

    const x0 = Math.max(0, Math.floor(cx - R - 1));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + R + 1));
    const y0 = Math.max(0, Math.floor(cy - R - 1));
    const y1 = Math.min(this.H - 1, Math.ceil(cy + R + 1));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cov = clamp01(
          0.5 -
            (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad) - half)
        );
        if (cov > 0) this.blend(x, y, col, cov);
      }
    }
  }

  /** Ellipse fill. */
  ellipse(ucx, ucy, urx, ury, col) {
    const s = this.s;
    const cx = ucx * s;
    const cy = ucy * s;
    const rx = urx * s;
    const ry = ury * s;

    const x0 = Math.max(0, Math.floor(cx - rx - 1));
    const x1 = Math.min(this.W - 1, Math.ceil(cx + rx + 1));
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(this.H - 1, Math.ceil(cy + ry + 1));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const cov = clamp01(0.5 - (d - 1));
        if (cov > 0) this.blend(x, y, col, cov);
      }
    }
  }

  /** Polygon fill with 4‑sample AA. */
  poly(upts, col) {
    const s = this.s;
    const pts = upts.map(([x, y]) => [x * s, y * s]);

    let minX = this.W,
      minY = this.H,
      maxX = 0,
      maxY = 0;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(this.W - 1, Math.ceil(maxX));
    maxY = Math.min(this.H - 1, Math.ceil(maxY));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let hits = 0;
        for (const sx of [0.25, 0.75]) {
          for (const sy of [0.25, 0.75]) {
            if (inPoly(x + sx, y + sy, pts)) hits++;
          }
        }
        if (hits) this.blend(x, y, col, hits / 4);
      }
    }
  }

  /** Simple line (stroke) using a disc brush. */
  line(ux1, uy1, ux2, uy2, width, col) {
    const s = this.s;
    const x1 = ux1 * s;
    const y1 = uy1 * s;
    const x2 = ux2 * s;
    const y2 = uy2 * s;
    const rad = (width * s) / 2;

    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - rad - 1));
    const maxX = Math.min(this.W - 1, Math.ceil(Math.max(x1, x2) + rad + 1));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - rad - 1));
    const maxY = Math.min(this.H - 1, Math.ceil(Math.max(y1, y2) + rad + 1));

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = ((px - x1) * dx + (py - y1) * dy) / len2;
        const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
        const lx = x1 + dx * clamped;
        const ly = y1 + dy * clamped;
        const d = Math.hypot(px - lx, py - ly);
        const cov = clamp01(0.5 - (d - rad));
        if (cov > 0) this.blend(x, y, col, cov);
      }
    }
  }

  data() {
    return encodePNG(this.d, this.W, this.H);
  }
}

/** Point‑in‑polygon test. */
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0],
      yi = pts[i][1];
    const xj = pts[j][0],
      yj = pts[j][1];
    if ((yi > y) !== (yj > y)) {
      const xInt = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < xInt) inside = !inside;
    }
  }
  return inside;
}

// ============================================================================
// SVG PARSING HELPERS
// ============================================================================

const attr = (tag, name) => {
  const m = tag.match(
    new RegExp(name.replace(/[-]/g, '\\$&') + '\\s*=\\s*"([^"]*)"')
  );
  return m ? m[1] : undefined;
};

const num = (tag, name, def = 0) => {
  const v = attr(tag, name);
  return v === undefined ? def : parseFloat(v);
};

// ============================================================================
// GRADIENTS
// ============================================================================

function parseLinearGradients(svg) {
  const grads = {};
  const re = /<linearGradient\b([^>]*)>([\s\S]*?)<\/linearGradient>/g;
  let m;
  while ((m = re.exec(svg))) {
    const head = m[1];
    const id = attr(head, 'id');
    if (!id) continue;
    const stops = [];
    const sre = /<stop\b([^>]*?)\/?>/g;
    let sm;
    while ((sm = sre.exec(m[2]))) {
      const off = parseFloat(attr(sm[1], 'offset') ?? '0');
      const col = attr(sm[1], 'stop-color') || '#000';
      stops.push({ off: isNaN(off) ? 0 : off, rgb: hexToRgb(col) });
    }
    grads[id] = {
      type: 'linear',
      x1: num(head, 'x1'),
      y1: num(head, 'y1'),
      x2: num(head, 'x2', 1),
      y2: num(head, 'y2'),
      stops,
    };
  }
  return grads;
}

function parseRadialGradients(svg) {
  const grads = {};
  const re = /<radialGradient\b([^>]*)>([\s\S]*?)<\/radialGradient>/g;
  let m;
  while ((m = re.exec(svg))) {
    const head = m[1];
    const id = attr(head, 'id');
    if (!id) continue;
    const stops = [];
    const sre = /<stop\b([^>]*?)\/?>/g;
    let sm;
    while ((sm = sre.exec(m[2]))) {
      const off = parseFloat(attr(sm[1], 'offset') ?? '0');
      const col = attr(sm[1], 'stop-color') || '#000';
      stops.push({ off: isNaN(off) ? 0 : off, rgb: hexToRgb(col) });
    }
    grads[id] = {
      type: 'radial',
      cx: num(head, 'cx', 0.5),
      cy: num(head, 'cy', 0.5),
      r: num(head, 'r', 0.5),
      stops,
    };
  }
  return grads;
}

function gradientResolverLinear(g) {
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const len2 = dx * dx + dy * dy || 1;
  const stops = g.stops.length ? g.stops : [{ off: 0, rgb: [0, 0, 0] }];
  return (ux, uy) => {
    let t = ((ux - g.x1) * dx + (uy - g.y1) * dy) / len2;
    t = clamp01(t);
    let a = stops[0],
      b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].off && t <= stops[i + 1].off) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const span = b.off - a.off || 1;
    const f = clamp01((t - a.off) / span);
    return [
      a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
      a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
      a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f,
    ];
  };
}

function gradientResolverRadial(g) {
  const stops = g.stops.length ? g.stops : [{ off: 0, rgb: [0, 0, 0] }];
  return (ux, uy) => {
    const dx = ux - g.cx;
    const dy = uy - g.cy;
    let t = Math.sqrt(dx * dx + dy * dy) / (g.r || 1);
    t = clamp01(t);
    let a = stops[0],
      b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].off && t <= stops[i + 1].off) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const span = b.off - a.off || 1;
    const f = clamp01((t - a.off) / span);
    return [
      a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
      a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
      a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f,
    ];
  };
}

// ============================================================================
// PATH PARSING (subset: M, L, H, V, Z)
// ============================================================================

function parsePathToPolygon(d) {
  if (!d) return [];
  const tokens = d
    .replace(/,/g, ' ')
    .replace(/([MLHVZmlhvz])/g, ' $1 ')
    .trim()
    .split(/\s+/);

  let i = 0;
  let cmd = '';
  let x = 0,
    y = 0;
  let startX = 0,
    startY = 0;
  const pts = [];

  while (i < tokens.length) {
    const t = tokens[i++];
    if (/^[MLHVZmlhvz]$/.test(t)) {
      cmd = t;
      if (cmd === 'Z' || cmd === 'z') {
        pts.push([startX, startY]);
      }
      continue;
    }

    const val = parseFloat(t);
    if (Number.isNaN(val)) continue;

    switch (cmd) {
      case 'M':
      case 'L': {
        const nx = val;
        const ny = parseFloat(tokens[i++] ?? '0');
        x = nx;
        y = ny;
        if (cmd === 'M') {
          startX = x;
          startY = y;
        }
        pts.push([x, y]);
        break;
      }
      case 'm':
      case 'l': {
        const nx = x + val;
        const ny = y + parseFloat(tokens[i++] ?? '0');
        x = nx;
        y = ny;
        if (cmd === 'm') {
          startX = x;
          startY = y;
        }
        pts.push([x, y]);
        break;
      }
      case 'H': {
        x = val;
        pts.push([x, y]);
        break;
      }
      case 'h': {
        x += val;
        pts.push([x, y]);
        break;
      }
      case 'V': {
        y = val;
        pts.push([x, y]);
        break;
      }
      case 'v': {
        y += val;
        pts.push([x, y]);
        break;
      }
      default:
        break;
    }
  }

  return pts;
}

// ============================================================================
// MAIN RASTERISER
// ============================================================================

/**
 * Rasterise an SVG string to a PNG Buffer at `size`x`size` (default 128).
 * opts: { debug?: boolean, background?: string|null, scale?: number }
 */
function svgToPng(svg, size = 128, opts = {}) {
  const debug = !!opts.debug;

  const vb = (attr(svg, 'viewBox') || '0 0 128 128')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const vbX = vb[0] || 0;
  const vbY = vb[1] || 0;
  const vbW = vb[2] || 128;
  const vbH = vb[3] || 128;

  const scale = opts.scale || size / vbW;
  const outH = Math.round(size * (vbH / vbW));

  const bgRgb = opts.background ? parseColor(opts.background) : null;
  const canvas = new Canvas(size, outH, scale, bgRgb);

  // Parse gradients
  const lin = parseLinearGradients(svg);
  const rad = parseRadialGradients(svg);
  const gradients = { ...lin, ...rad };

  // Remove <defs> so we don't treat gradient tags as shapes.
  const body = svg.replace(/<defs\b[\s\S]*?<\/defs>/g, '');

  const re = /<(rect|circle|ellipse|polygon|line|path)\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(body))) {
    const type = m[1];
    const tag = m[0];

    const fillAttr = attr(tag, 'fill');
    const strokeAttr = attr(tag, 'stroke');
    const strokeWidth = num(tag, 'stroke-width', 1);

    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[svg2png] draw', type, 'fill=', fillAttr, 'stroke=', strokeAttr);
    }

    const resolveFill = () => {
      if (!fillAttr) return null;
      if (fillAttr.startsWith('url(')) {
        const id = fillAttr.slice(fillAttr.indexOf('#') + 1, fillAttr.indexOf(')'));
        const g = gradients[id];
        if (!g) return null;
        if (g.type === 'linear') return gradientResolverLinear(g);
        if (g.type === 'radial') return gradientResolverRadial(g);
        return null;
      }
      const col = parseColor(fillAttr);
      if (!col) return null;
      return () => col;
    };

    const fillFn = resolveFill();
    const strokeCol = parseColor(strokeAttr);

    if (type === 'rect') {
      const x = num(tag, 'x') - vbX;
      const y = num(tag, 'y') - vbY;
      const w = num(tag, 'width');
      const h = num(tag, 'height');
      const rx = num(tag, 'rx', num(tag, 'ry', 0));
      if (fillFn) {
        canvas.roundedRect(x, y, w, h, rx, (ux, uy) => fillFn(ux, uy));
      }
      if (strokeCol && strokeWidth > 0) {
        // crude stroke: draw slightly larger rect ring
        const sw = strokeWidth;
        canvas.roundedRect(
          x - sw / 2,
          y - sw / 2,
          w + sw,
          h + sw,
          rx + sw / 2,
          () => strokeCol
        );
      }
    } else if (type === 'circle') {
      const cx = num(tag, 'cx') - vbX;
      const cy = num(tag, 'cy') - vbY;
      const r = num(tag, 'r');
      if (fillFn) {
        const col = fillFn(cx, cy);
        canvas.disc(cx, cy, r, col);
      }
      if (strokeCol && strokeWidth > 0) {
        canvas.ring(cx, cy, r, strokeWidth, strokeCol);
      }
    } else if (type === 'ellipse') {
      const cx = num(tag, 'cx') - vbX;
      const cy = num(tag, 'cy') - vbY;
      const rx = num(tag, 'rx');
      const ry = num(tag, 'ry');
      if (fillFn) {
        const col = fillFn(cx, cy);
        canvas.ellipse(cx, cy, rx, ry, col);
      }
      if (strokeCol && strokeWidth > 0) {
        // approximate stroke by drawing slightly larger ellipse
        canvas.ellipse(cx, cy, rx + strokeWidth / 2, ry + strokeWidth / 2, strokeCol);
      }
    } else if (type === 'polygon') {
      const ptsRaw = attr(tag, 'points') || '';
      const nums = ptsRaw
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        pts.push([nums[i] - vbX, nums[i + 1] - vbY]);
      }
      if (fillFn && pts.length >= 3) {
        const col = fillFn(pts[0][0], pts[0][1]);
        canvas.poly(pts, col);
      }
    } else if (type === 'line') {
      const x1 = num(tag, 'x1') - vbX;
      const y1 = num(tag, 'y1') - vbY;
      const x2 = num(tag, 'x2') - vbX;
      const y2 = num(tag, 'y2') - vbY;
      if (strokeCol && strokeWidth > 0) {
        canvas.line(x1, y1, x2, y2, strokeWidth, strokeCol);
      }
    } else if (type === 'path') {
      const d = attr(tag, 'd') || '';
      const pts = parsePathToPolygon(d).map(([px, py]) => [px - vbX, py - vbY]);
      if (fillFn && pts.length >= 3) {
        const col = fillFn(pts[0][0], pts[0][1]);
        canvas.poly(pts, col);
      }
      if (strokeCol && strokeWidth > 0 && pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[i + 1];
          canvas.line(x1, y1, x2, y2, strokeWidth, strokeCol);
        }
      }
    }
  }

  return canvas.data();
}

module.exports = { svgToPng };

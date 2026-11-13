// Generates Aria's Apple-style app icons with pure Node (no image libraries).
// node scripts/make-icon.mjs  → assets/images/{icon,icon-dark,icon-tinted,adaptive-icon,splash-icon,favicon}.png
import fs from 'fs';
import zlib from 'zlib';

const OUT = new URL('../assets/images/', import.meta.url);

/* ── PNG writer ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(w, h, rgba, alpha) {
  const ch = alpha ? 4 : 3, raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * ch + 1)] = 0; for (let x = 0; x < w; x++) for (let k = 0; k < ch; k++) raw[y * (w * ch + 1) + 1 + x * ch + k] = Math.max(0, Math.min(255, Math.round(rgba[(y * w + x) * 4 + k]))); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ── shapes (coverage via 4×4 supersampling) ── */
const N = 1024, SS = 4;
// 4-point concave "spark": superellipse with exponent < 1.
const sparkIn = (x, y, cx, cy, R) => { const p = 0.56; const u = Math.abs(x - cx) / R, v = Math.abs(y - cy) / R; return Math.pow(u, p) + Math.pow(v, p) <= 1; };
function mask(fn) { const m = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let c = 0; for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if (fn(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) c++; m[y * N + x] = c / (SS * SS); } return m; }
function blur(m, r) { // 3× separable box blur ≈ gaussian
  let a = Float32Array.from(m), b = new Float32Array(N * N);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < N; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * N + Math.min(N - 1, Math.max(0, x))]; for (let x = 0; x < N; x++) { b[y * N + x] = s / (2 * r + 1); s += a[y * N + Math.min(N - 1, x + r + 1)] - a[y * N + Math.max(0, x - r)]; } }
    for (let x = 0; x < N; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(N - 1, Math.max(0, y)) * N + x]; for (let y = 0; y < N; y++) { a[y * N + x] = s / (2 * r + 1); s += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x]; } }
  }
  return a;
}
const mix = (a, b, t) => a + (b - a) * t;
const lerp3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const C = N / 2;
const R_SPARK = 250, R_DISC = 330;
const spark = mask((x, y) => sparkIn(x, y, C, C + 6, R_SPARK));
const disc = mask((x, y) => (x - C) ** 2 + (y - C) ** 2 <= R_DISC ** 2);
const discInner = mask((x, y) => (x - C) ** 2 + (y - C) ** 2 <= (R_DISC - 5) ** 2);
const shadow = blur(mask((x, y) => sparkIn(x, y, C, C + 30, R_SPARK)), 18);
const discShadow = blur(mask((x, y) => (x - C) ** 2 + (y - C - 24) ** 2 <= R_DISC ** 2), 26);

function render({ top, bottom, glyphTop, glyphBottom, discTint, discAlpha, rimAlpha, transparent, glyphOnly }) {
  const img = new Float32Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, o = i * 4;
    let col = transparent ? [0, 0, 0] : lerp3(top, bottom, y / N);
    let a = transparent ? 0 : 255;
    if (!transparent) { // soft top-left light
      const d = Math.hypot(x - N * 0.28, y - N * 0.12) / (N * 0.75);
      const hl = Math.max(0, 1 - d) ** 2 * 0.22;
      col = lerp3(col, [255, 255, 255], hl);
    }
    if (!glyphOnly) {
      // disc drop shadow, frosted disc, bright rim (stronger at the top)
      col = lerp3(col, [0, 0, 0], discShadow[i] * 0.12);
      col = lerp3(col, discTint, disc[i] * discAlpha);
      const rim = Math.max(0, disc[i] - discInner[i]);
      const topBias = 0.35 + 0.65 * Math.max(0, 1 - (y - (C - R_DISC)) / (2 * R_DISC));
      col = lerp3(col, [255, 255, 255], rim * rimAlpha * topBias);
    }
    // glyph shadow + glyph with vertical gradient
    col = lerp3(col, [0, 0, 0], shadow[i] * (glyphOnly ? 0 : 0.22));
    const gt = (y - (C - R_SPARK)) / (2 * R_SPARK);
    const g = lerp3(glyphTop, glyphBottom, Math.max(0, Math.min(1, gt)));
    col = lerp3(col, g, spark[i]);
    if (transparent) a = Math.max(spark[i], glyphOnly ? 0 : disc[i] * 0.0) * 255;
    img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; img[o + 3] = a;
  }
  return img;
}
function downsample(img, size) {
  const out = new Float32Array(size * size * 4), f = N / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0, 0]; let n = 0;
    for (let j = Math.floor(y * f); j < Math.floor((y + 1) * f); j++) for (let i = Math.floor(x * f); i < Math.floor((x + 1) * f); i++) { const o = (j * N + i) * 4; for (let k = 0; k < 4; k++) acc[k] += img[o + k]; n++; }
    for (let k = 0; k < 4; k++) out[(y * size + x) * 4 + k] = acc[k] / n;
  }
  return out;
}

const light = render({ top: hex('#4FA6FF'), bottom: hex('#1D4FE0'), glyphTop: hex('#FFFFFF'), glyphBottom: hex('#E2EBFF'), discTint: [255, 255, 255], discAlpha: 0.16, rimAlpha: 0.55 });
const dark = render({ top: hex('#1C1C1E'), bottom: hex('#050506'), glyphTop: hex('#8EC5FF'), glyphBottom: hex('#3D7BFF'), discTint: [120, 160, 255], discAlpha: 0.1, rimAlpha: 0.35 });
const tinted = render({ top: hex('#000000'), bottom: hex('#000000'), glyphTop: hex('#FFFFFF'), glyphBottom: hex('#D8D8D8'), discTint: [255, 255, 255], discAlpha: 0.08, rimAlpha: 0.3 });
const glyph = render({ top: [0, 0, 0], bottom: [0, 0, 0], glyphTop: hex('#FFFFFF'), glyphBottom: hex('#E2EBFF'), discTint: [0, 0, 0], discAlpha: 0, rimAlpha: 0, transparent: true, glyphOnly: true });

fs.writeFileSync(new URL('icon.png', OUT), png(N, N, light, false));
fs.writeFileSync(new URL('icon-dark.png', OUT), png(N, N, dark, false));
fs.writeFileSync(new URL('icon-tinted.png', OUT), png(N, N, tinted, false));
fs.writeFileSync(new URL('adaptive-icon.png', OUT), png(N, N, light, false));
fs.writeFileSync(new URL('splash-icon.png', OUT), png(N, N, glyph, true));
fs.writeFileSync(new URL('favicon.png', OUT), png(64, 64, downsample(light, 64), false));
console.log('icons written');

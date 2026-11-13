// Generates Aria's app icons with pure Node (no image libraries).
// Flat, Apple-style: solid background, one solid glyph — no gradients, no glow.
// node scripts/make-icon.mjs → assets/images/{icon,icon-dark,icon-tinted,adaptive-icon,splash-icon,favicon}.png
import fs from 'fs';
import zlib from 'zlib';

const OUT = new URL('../assets/images/', import.meta.url);
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(w, h, px, alpha) {
  const ch = alpha ? 4 : 3, raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * ch + 1)] = 0; for (let x = 0; x < w; x++) for (let k = 0; k < ch; k++) raw[y * (w * ch + 1) + 1 + x * ch + k] = Math.max(0, Math.min(255, Math.round(px[(y * w + x) * 4 + k]))); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const N = 1024, SS = 4, C = N / 2;
// Signed-distance helpers.
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => { const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
function inTri(px, py, ax, ay, bx, by, cx, cy) { const d = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3); const d1 = d(px, py, ax, ay, bx, by), d2 = d(px, py, bx, by, cx, cy), d3 = d(px, py, cx, cy, ax, ay); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }
// Speech bubble: a rounded body plus a short tail at the lower left.
// Curved tail like Apple's bubbles: inside one circle, outside an offset one (a crescent).
const tail = (x, y) => y > C + 90 && x < C - 40 && Math.hypot(x - (C - 150), y - (C + 75)) <= 175 && Math.hypot(x - (C - 330), y - (C + 70)) >= 200;
const bubble = (x, y) => sdRoundRect(x, y, C, C, 300, 250, 110) <= 0;
// Three lines of "text" inside the bubble.
const lines = (x, y) => [[C - 110, 360], [C, 360], [C + 110, 230]].some(([cy, w]) => sdRoundRect(x, y, C - 180 + w / 2, cy, w / 2, 28, 28) <= 0);

function cover(fn) { const m = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let c = 0; for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if (fn(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) c++; m[y * N + x] = c / (SS * SS); } return m; }
const B = cover(bubble), T = cover(lines);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function render(bg, glyph, ink, transparent) {
  const px = new Float32Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    let col = bg; let a = 255;
    col = mix(col, glyph, B[i]);
    col = mix(col, ink, T[i] * B[i]);
    if (transparent) { col = mix(glyph, ink, T[i]); a = B[i] * 255; }
    px[i * 4] = col[0]; px[i * 4 + 1] = col[1]; px[i * 4 + 2] = col[2]; px[i * 4 + 3] = a;
  }
  return px;
}
function downsample(img, size) {
  const out = new Float32Array(size * size * 4), f = N / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const acc = [0, 0, 0, 0]; let n = 0; for (let j = Math.floor(y * f); j < Math.floor((y + 1) * f); j++) for (let i = Math.floor(x * f); i < Math.floor((x + 1) * f); i++) { const o = (j * N + i) * 4; for (let k = 0; k < 4; k++) acc[k] += img[o + k]; n++; } for (let k = 0; k < 4; k++) out[(y * size + x) * 4 + k] = acc[k] / n; }
  return out;
}

const light = render(hex('#FFFFFF'), hex('#007AFF'), hex('#FFFFFF'));
const dark = render(hex('#000000'), hex('#0A84FF'), hex('#000000'));
const tinted = render(hex('#000000'), hex('#FFFFFF'), hex('#000000'));
const glyph = render(hex('#000000'), hex('#FFFFFF'), hex('#007AFF'), true);

fs.writeFileSync(new URL('icon.png', OUT), png(N, N, light, false));
fs.writeFileSync(new URL('icon-dark.png', OUT), png(N, N, dark, false));
fs.writeFileSync(new URL('icon-tinted.png', OUT), png(N, N, tinted, false));
fs.writeFileSync(new URL('adaptive-icon.png', OUT), png(N, N, light, false));
fs.writeFileSync(new URL('splash-icon.png', OUT), png(N, N, glyph, true));
fs.writeFileSync(new URL('favicon.png', OUT), png(64, 64, downsample(light, 64), false));
console.log('icons written');

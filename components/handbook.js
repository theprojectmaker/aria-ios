/* The Handbook — ~1,100 short, fact-checked reference entries (formulas,
   rules, definitions, elements, countries, presidents, states) bundled in the
   app. Small enough to index in memory; searched before the encyclopedia so
   the model gets the exact formula or table row, not a vague article.
   Loaded lazily after first render (like the encyclopedia). */
import { terms, titleKey } from './libsearch.js';

let H = null;      // [{t, a, s, x}]
let INDEX = null;  // Map(stem → [[i, w], ...])
let TITLES = null; // Map(titleKey → i)
let loading = null;

export function loadHandbook() {
  if (loading) return loading;
  loading = new Promise((resolve) => setTimeout(() => {
    try { indexHandbook(require('./kb/handbook.json')); } catch (e) { H = []; INDEX = new Map(); TITLES = new Map(); }
    resolve();
  }, 250));
  return loading;
}

// Build the in-memory index (exported so Node tests can call it directly).
export function indexHandbook(arr) {
  {
    {
      H = arr;
      INDEX = new Map(); TITLES = new Map();
      const df = new Map();
      const per = H.map((e) => {
        const tt = new Set(terms(e.t + ' ' + (e.a || []).join(' ')));
        const bt = new Set(terms(e.x));
        for (const s of new Set([...tt, ...bt])) df.set(s, (df.get(s) || 0) + 1);
        return { tt, bt };
      });
      const N = H.length;
      per.forEach(({ tt, bt }, i) => {
        for (const s of new Set([...tt, ...bt])) {
          const idf = Math.log(1 + N / (df.get(s) || 1));
          const w = idf * (tt.has(s) ? 4 : 1);
          if (!INDEX.has(s)) INDEX.set(s, []);
          INDEX.get(s).push([i, w]);
        }
        const keys = [H[i].t, ...(H[i].a || [])].map(titleKey).filter(Boolean);
        for (const k of keys) if (!TITLES.has(k)) TITLES.set(k, i);
      });
    }
  }
}

export function handbookReady() { return !!H && H.length > 0; }
export function handbookCount() { return H ? H.length : 0; }

export function searchHandbook(query, k = 2) {
  if (!handbookReady()) return [];
  const base = terms(query).slice(0, 10);
  const qs = Array.from(new Set(base));
  if (!qs.length) return [];
  const score = new Map(); const hits = new Map();
  for (let n = Math.min(5, base.length); n >= 1; n--) {
    for (let i = 0; i + n <= base.length; i++) {
      const id = TITLES.get(Array.from(new Set(base.slice(i, i + n))).sort().join(' '));
      if (id !== undefined) score.set(id, (score.get(id) || 0) + 40 * Math.pow(n / base.length, 2));
    }
  }
  for (const s of qs) {
    const post = INDEX.get(s);
    if (!post || post.length > H.length * 0.25) continue; // ignore near-universal terms
    for (const [i, w] of post) { score.set(i, (score.get(i) || 0) + w); hits.set(i, (hits.get(i) || 0) + 1); }
  }
  const need = qs.length >= 3 ? Math.ceil(qs.length * 0.6) : qs.length;
  const ranked = [...score].filter(([i, s]) => (hits.get(i) || 0) >= need || s >= 20).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 8) return [];
  const floor = ranked[0][1] * 0.5;
  return ranked.slice(0, k).filter(([, s]) => s >= floor).map(([i, s]) => ({ title: H[i].t, text: H[i].x, subject: H[i].s, score: Math.round(s * 10) / 10, source: 'handbook' }));
}

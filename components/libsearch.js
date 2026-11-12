/* Library search — pure JavaScript shared by the app and the Node pack builder
   (scripts/build-library.mjs) so what we measure is exactly what ships.

   The Library pack is a folder of small JSON shards:
     manifest.json                  { version, docs, perDoc, indexShards, dictShards, files[] }
     i/<n>.json   inverted index    { stem: [docId, weight×10, docId, weight×10, ...] }
     d/<n>.json   documents         [[title, text], ...]   (docId = n × perDoc + i)
     w/<n>.json   dictionary        { word: "definition…" }
   A query reads only the index shards for its terms and the doc shards of its
   top hits, so RAM stays tiny even though the pack holds ~76,000 articles. */

export const STOP = new Set(
  ('the a an of to in on at for and or but is are was were be been being this that these those it its as by ' +
   'with from into over under about above below after before between you your they them their he she his her ' +
   'what when where why how who which do does did can could should would may might will just also only more ' +
   'most some any all each both many much other get make made use used using please tell give given show ' +
   'explain explains mean means there here hi hello hey thanks thank ok okay yes yeah well lets let whats want ' +
   'wants need needs know think thing things stuff done say said look new old good bad same different me my i ' +
   'we us our am not no so than then too very one two first also it\'s')
    .split(' ')
);

export function stem(w) {
  if (w.length <= 4) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(w)) return w;
  if (/(sses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (/ing$/.test(w)) return w.length - 3 >= 4 ? w.slice(0, -3) : w;
  if (/ed$/.test(w) && !/eed$/.test(w)) return w.length - 2 >= 4 ? w.slice(0, -2) : w;
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

export function terms(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => (w.length > 1 || /\d/.test(w)) && !STOP.has(w))
    .map(stem);
}

// Order-insensitive key for a title or phrase: "Cell (biology)" → "cell".
export function titleKey(s) {
  const t = terms(String(s || '').replace(/\s*\([^)]*\)\s*/g, ' '));
  return t.length && t.length <= 6 ? Array.from(new Set(t)).sort().join(' ') : '';
}

// A few query rewrites small models' users need ("how fast" → speed).
const SYN = { fast: 'speed', quick: 'speed', tall: 'height', tallest: 'highest', biggest: 'largest', big: 'large', smallest: 'small', hot: 'temperature', far: 'distance', old: 'age', heavy: 'weight' };

// FNV-1a → shard number.
export function shardOf(str, n) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % n;
}

/**
 * createLibrary({ readText, manifest, cacheSize })
 *   readText(relPath) → Promise<string>   (e.g. 'i/12.json')
 * returns { search(query, k), define(word) }
 */
export function createLibrary({ readText, manifest, cacheSize = 24 }) {
  const cache = new Map();
  async function load(rel) {
    if (cache.has(rel)) { const v = cache.get(rel); cache.delete(rel); cache.set(rel, v); return v; }
    const v = JSON.parse(await readText(rel));
    cache.set(rel, v);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
    return v;
  }

  async function search(query, k = 3) {
    const base = terms(query).slice(0, 10);
    if (!base.length) return [];
    const qs = Array.from(new Set(base));
    const extra = qs.map((t) => SYN[t]).filter((x) => x && !qs.includes(x));
    const score = new Map();
    const hits = new Map();
    // Exact-title bonus: any contiguous phrase of the question that IS a title.
    const alt = base.map((t) => SYN[t] || t);
    const variants = alt.join(' ') !== base.join(' ') ? [base, alt] : [base];
    const bonused = new Set();
    const titled = new Set();
    if (manifest.titleShards) for (const words of variants) {
      for (let n = Math.min(4, words.length); n >= 1; n--) {
        for (let i = 0; i + n <= words.length; i++) {
          const key = Array.from(new Set(words.slice(i, i + n))).sort().join(' ');
          if (bonused.has(key)) continue;
          bonused.add(key);
          try {
            const sh = await load(`t/${shardOf(key, manifest.titleShards)}.json`);
            const id = sh[key];
            if (id !== undefined) { titled.add(id); score.set(id, (score.get(id) || 0) + 60 * Math.pow(n / base.length, 2)); hits.set(id, (hits.get(id) || 0)); }
          } catch (e) {}
        }
      }
    }
    for (const t of qs.concat(extra)) {
      let shard;
      try { shard = await load(`i/${shardOf(t, manifest.indexShards)}.json`); } catch (e) { continue; }
      const post = shard[t];
      if (!post) continue;
      for (let i = 0; i < post.length; i += 2) {
        const id = post[i];
        score.set(id, (score.get(id) || 0) + post[i + 1] / 10);
        if (!extra.includes(t)) hits.set(id, (hits.get(id) || 0) + 1);
      }
    }
    if (!score.size) return [];
    const need = qs.length >= 3 ? Math.ceil(qs.length * 0.5) : 1;
    const ranked = [];
    for (const [id, s] of score) {
      const h = hits.get(id) || 0;
      if (h < need && !titled.has(id)) continue;
      ranked.push([id, s * (0.5 + 0.5 * (h / qs.length)) + h * 2]);
    }
    ranked.sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return [];
    const floor = ranked[0][1] * 0.35;
    const out = [];
    for (const [id, s] of ranked.slice(0, k)) {
      if (s < floor) break;
      const docs = await load(`d/${Math.floor(id / manifest.perDoc)}.json`);
      const d = docs[id % manifest.perDoc];
      if (d) out.push({ title: d[0], text: d[1], score: Math.round(s * 10) / 10, source: 'library' });
    }
    return out;
  }

  async function define(word) {
    const w0 = String(word || '').toLowerCase().trim().replace(/[^a-z' -]/g, '');
    if (!w0) return null;
    const cands = [w0, w0.replace(/ies$/, 'y'), w0.replace(/es$/, ''), w0.replace(/s$/, ''), w0.replace(/ing$/, ''), w0.replace(/ing$/, 'e'), w0.replace(/ed$/, ''), w0.replace(/ed$/, 'e'), w0.replace(/ly$/, '')];
    for (const c of cands) {
      if (!c) continue;
      try {
        const shard = await load(`w/${shardOf(c, manifest.dictShards)}.json`);
        if (shard[c]) return { word: c, definition: shard[c] };
      } catch (e) {}
    }
    return null;
  }

  return { search, define };
}

// Pull the word out of "define X", "what does X mean", "meaning of X".
export function definitionTarget(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.!]+$/, '');
  const m = t.match(/^(?:define|definition of|meaning of|what(?:'s| is) the meaning of|what does)\s+(?:the word\s+)?["']?([a-z][a-z' -]{1,30}?)["']?(?:\s+mean)?$/);
  return m ? m[1].trim() : null;
}

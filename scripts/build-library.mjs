// Builds the downloadable Library pack (Simple English Wikipedia + Webster 1913).
// Usage: node scripts/build-library.mjs <outDir>
// Source data comes from the Lexicon app's pipeline (../lexicon-native/pipeline/data).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { terms, shardOf, titleKey } from '../components/libsearch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../../lexicon-native/pipeline/data');
const OUT = path.resolve(process.argv[2] || path.join(here, '../library-pack'));
const PER_DOC = 1000, TITLE_SHARDS = 48, INDEX_SHARDS = 96, DICT_SHARDS = 48, BODY_TERMS = 18, MAX_POSTINGS = 700;

const full = JSON.parse(fs.readFileSync(path.join(DATA, 'encyclopedia-full-raw.json'), 'utf8'));
const curated = JSON.parse(fs.readFileSync(path.join(DATA, 'encyclopedia.json'), 'utf8'));
const better = new Map(curated.map((e) => [e.title, e.summary]));

// Clean: drop stubs, disambiguation pages, list-only and junk titles.
const seen = new Set();
const docs = [];
for (const e of full) {
  const title = String(e.title || '').trim();
  let text = String(better.get(title) || e.extract || '').replace(/\s+/g, ' ').trim();
  if (!title || seen.has(title.toLowerCase())) continue;
  if (text.length < 80) continue;
  if (/\(disambiguation\)$/i.test(title) || /may (also )?refer to:?$/i.test(text.slice(0, 200)) || /\bmay refer to\b/i.test(text.slice(0, 120))) continue;
  if (/^[^a-zA-Z0-9]/.test(title)) continue;
  seen.add(title.toLowerCase());
  if (text.length > 1300) text = text.slice(0, 1300).replace(/\s+\S*$/, '') + '…';
  docs.push([title, text]);
}
for (const [title, summary] of better) if (!seen.has(title.toLowerCase())) { docs.push([title, summary.slice(0, 1300)]); seen.add(title.toLowerCase()); }
docs.sort((a, b) => a[0].localeCompare(b[0]));
const core = new Set(curated.map((e) => e.title));
console.log('docs kept', docs.length, 'of', full.length);

// Document frequency over title + body terms.
const df = new Map();
const docTerms = docs.map(([title, text]) => {
  const tt = terms(title), bt = terms(text);
  const tf = new Map();
  for (const t of bt) tf.set(t, (tf.get(t) || 0) + 1);
  const set = new Set([...tt, ...tf.keys()]);
  for (const t of set) df.set(t, (df.get(t) || 0) + 1);
  return { tt: new Set(tt), tf, len: bt.length };
});
const N = docs.length;
const avgLen = docTerms.reduce((a, d) => a + d.len, 0) / N;
const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));

// Postings: every title term + the top BODY_TERMS BM25 terms of each doc.
const post = new Map();
docTerms.forEach((d, id) => {
  const cand = [];
  for (const [t, f] of d.tf) {
    const bm = idf(t) * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / avgLen));
    cand.push([t, bm]);
  }
  cand.sort((a, b) => b[1] - a[1]);
  const keep = new Map(cand.slice(0, BODY_TERMS));
  const titleN = d.tt.size || 1;
  for (const t of d.tt) keep.set(t, (keep.get(t) || 0) + idf(t) * (2 + 3 / titleN)); // short titles weigh more per term
  for (const [t, w] of keep) {
    if (!post.has(t)) post.set(t, []);
    post.get(t).push([id, Math.max(1, Math.round(w * (core.has(docs[id][0]) ? 12.5 : 10)))]);
  }
});
let postings = 0;
const shards = Array.from({ length: INDEX_SHARDS }, () => ({}));
for (const [t, list] of post) {
  list.sort((a, b) => b[1] - a[1]);
  const top = list.slice(0, MAX_POSTINGS);
  postings += top.length;
  shards[shardOf(t, INDEX_SHARDS)][t] = top.flat();
}

// Title index: order-insensitive stem key → best doc (core topics and shorter titles win).
const tshards = Array.from({ length: TITLE_SHARDS }, () => ({}));
const tbest = new Map();
docs.forEach(([title], id) => {
  const k = titleKey(title);
  if (!k) return;
  const rank = (core.has(title) ? 0 : 1000) + title.length;
  const cur = tbest.get(k);
  if (!cur || rank < cur[1]) tbest.set(k, [id, rank]);
});
for (const [k, [id]] of tbest) tshards[shardOf(k, TITLE_SHARDS)][k] = id;

// Dictionary: real headwords only, up to 3 senses each.
const dict = JSON.parse(fs.readFileSync(path.join(DATA, 'dictionary.json'), 'utf8'));
const words = new Map();
for (const e of dict) {
  const k = String(e.key || '').toLowerCase();
  if (!/^[a-z][a-z' -]*$/.test(k) || k.length > 30) continue;
  const def = String(e.definition || '').replace(/\s+/g, ' ').trim();
  if (def.length < 4) continue;
  const arr = words.get(k) || [];
  if (arr.length < 3 && !arr.includes(def)) arr.push(def.slice(0, 400));
  words.set(k, arr);
}
const dshards = Array.from({ length: DICT_SHARDS }, () => ({}));
for (const [k, arr] of words) dshards[shardOf(k, DICT_SHARDS)][k] = arr.length === 1 ? arr[0] : arr.map((d, i) => `${i + 1}. ${d}`).join(' ');
console.log('dictionary words', words.size);

// Write.
fs.rmSync(OUT, { recursive: true, force: true });
for (const sub of ['i', 'd', 'w', 't']) fs.mkdirSync(path.join(OUT, sub), { recursive: true });
const files = [];
const write = (rel, obj) => { const s = JSON.stringify(obj); fs.writeFileSync(path.join(OUT, rel), s); files.push({ name: rel, bytes: Buffer.byteLength(s) }); };
shards.forEach((s, i) => write(`i/${i}.json`, s));
for (let i = 0; i * PER_DOC < docs.length; i++) write(`d/${i}.json`, docs.slice(i * PER_DOC, (i + 1) * PER_DOC));
dshards.forEach((s, i) => write(`w/${i}.json`, s));
tshards.forEach((s, i) => write(`t/${i}.json`, s));
const total = files.reduce((a, f) => a + f.bytes, 0);
const manifest = { version: 1, created: process.env.BUILD_DATE || 'unset', docs: docs.length, words: words.size, perDoc: PER_DOC, titleShards: TITLE_SHARDS, indexShards: INDEX_SHARDS, dictShards: DICT_SHARDS, bytes: total, files, license: 'Simple English Wikipedia (CC BY-SA 4.0); Webster 1913 (public domain)' };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
const largest = files.reduce((a, f) => (f.bytes > a.bytes ? f : a));
console.log(`files ${files.length + 1}, total ${(total / 1048576).toFixed(1)} MB, largest ${largest.name} ${(largest.bytes / 1024).toFixed(0)} KB, postings ${postings}`);

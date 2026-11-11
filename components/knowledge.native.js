/* Offline knowledge pack — ~9,000 Simple Wikipedia articles ({title, key,
   summary}), bundled and searched entirely on-device, no network ever.

   Loaded LAZILY, one tick after the first frame paints: eager require() of this
   ~9 MB JSON blocks the JS thread before first render and can trip iOS's launch
   watchdog (an instant crash at open) — proven in the Lexicon app. Call
   loadKnowledge() once on mount, then retrieve(query).

   Retrieval is a plain scan with IDF-weighted, stemmed, word-start matching —
   no native deps, no prebuilt index to ship; a small document-frequency map is
   built once at load so rare/specific terms outweigh common ones.

   Content: Simple English Wikipedia (CC BY-SA). */

let DATA = null;        // [{title, key, summary}]
let DF = null;          // Map(stem -> document frequency)
let loadPromise = null;

const STOP = new Set(
  ('the a an of to in on at for and or but is are was were be been being this that these those it its as by ' +
   'with from into over under about above below after before between you your they them their he she his her ' +
   'what when where why how who which do does did can could should would may might will just also only more ' +
   'most some any all each both many much other get make made use used using please tell give given show ' +
   'explain explains mean means there here hi hello hey yo sup thanks thank thx thankyou ok okay yes yeah yep ' +
   'nope hmm well lets let whats want wants need needs know think thing things stuff work works working worked ' +
   'done say said look looks looking new old good bad big small long short high low same different')
    .split(' ')
);

function terms(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// Light stemming — fold common plural/inflection endings so "volcanoes" matches
// "Volcano". Only applied to longer words to avoid butchering short ones.
function stem(w) {
  return w.length > 4 ? w.replace(/(ies|ing|ed|es|s)$/, '') : w;
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function loadKnowledge() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    setTimeout(() => {
      try {
        DATA = require('./kb/encyclopedia.json');
        // One pass: document frequency per stem, for IDF weighting.
        const df = new Map();
        for (let i = 0; i < DATA.length; i++) {
          const art = DATA[i];
          const seen = new Set(terms(art.title).concat(terms(art.summary)).map(stem));
          for (const s of seen) df.set(s, (df.get(s) || 0) + 1);
        }
        DF = df;
      } catch (e) {
        DATA = [];
        DF = new Map();
      }
      resolve();
    }, 400);
  });
  return loadPromise;
}

export function knowledgeReady() { return Array.isArray(DATA) && DATA.length > 0; }
export function knowledgeCount() { return DATA ? DATA.length : 0; }

function idf(s) {
  const n = DATA.length;
  return Math.log((n + 1) / ((DF.get(s) || 0) + 1)) + 1; // rare terms weigh more
}

export function retrieve(query, k = 3) {
  if (!knowledgeReady() || !DF) return [];
  const uniq = Array.from(new Set(terms(query).map(stem))).filter((w) => w.length > 2).slice(0, 8);
  if (!uniq.length) return [];
  const res = uniq.map((s) => ({ w: idf(s), re: new RegExp('\\b' + esc(s)) }));
  const scored = [];
  for (let i = 0; i < DATA.length; i++) {
    const art = DATA[i];
    const title = (art.title || '').toLowerCase();
    const body = (art.summary || '').toLowerCase();
    let score = 0;
    let covered = 0;
    for (const { w, re } of res) {
      const inTitle = re.test(title);
      const inBody = re.test(body);
      if (inTitle) score += 8 * w;
      if (inBody) score += 1 * w;
      if (inTitle || inBody) covered += 1;
    }
    if (covered > 0) {
      score += covered * 3;
      scored.push({ art, score, covered });
    }
  }
  if (!scored.length) return [];
  scored.sort((a, b) => b.score - a.score);
  const need = Math.max(1, Math.ceil(uniq.length * 0.5));
  const floor = Math.max(20, scored[0].score * 0.33);
  return scored
    .filter((s) => s.covered >= need && s.score >= floor)
    .slice(0, k)
    .map((s) => ({ title: s.art.title, summary: s.art.summary, score: Math.round(s.score) }));
}

// Build a compact reference block for the LLM prompt, within a char budget.
export function buildContext(query, { k = 3, budget = 750 } = {}) {
  const refs = retrieve(query, k);
  if (!refs.length) return '';
  return refs.map((r) => `## ${r.title}\n${String(r.summary).slice(0, budget)}`).join('\n\n');
}

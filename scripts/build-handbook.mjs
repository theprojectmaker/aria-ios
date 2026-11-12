// node scripts/build-handbook.mjs <handbookSrcDir>  → components/kb/handbook.json
// Merges the fact-checked Handbook source files into the slim bundle the app loads.
import fs from 'fs';
import path from 'path';
const src = process.argv[2];
const out = new URL('../components/kb/handbook.json', import.meta.url);
const all = [];
const ids = new Set();
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.json')).sort()) {
  const arr = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  for (const e of arr) {
    if (!e || !e.id || ids.has(e.id) || !e.text) continue;
    ids.add(e.id);
    all.push({ t: e.title, a: (e.aliases || []).slice(0, 8), s: e.subject, x: e.text });
  }
  console.log(f, arr.length);
}
fs.writeFileSync(out, JSON.stringify(all));
console.log('handbook entries', all.length, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');

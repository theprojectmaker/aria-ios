// node scripts/test-handbook.mjs — retrieval checks for the bundled Handbook
import fs from 'fs';
import { indexHandbook, searchHandbook } from '../components/handbook.js';
indexHandbook(JSON.parse(fs.readFileSync(new URL('../components/kb/handbook.json', import.meta.url), 'utf8')));
const Q = [
  ['capital of japan', 'Japan'], ['what is the atomic mass of gold', 'Gold (Au)'], ['who was the 16th president', 'Abraham Lincoln'],
  ['capital of california', 'California (US state)'], ['population of india', 'India'], ['element 26', 'Iron (Fe)'],
  ['noble gases', 'Noble gases'], ['state capitals', 'US state capitals'], ['how many protons does carbon have', 'Carbon (C)'],
  ['currency of mexico', 'Mexico'], ['when did hawaii become a state', 'Hawaii (US state)'], ['diatomic elements', 'The seven diatomic elements'],
];
let ok = 0;
for (const [q, want] of Q) {
  const r = searchHandbook(q, 2).map((x) => x.title);
  const hit = r.some((t) => t.startsWith(want));
  if (hit) ok++; else console.log('miss:', q, '→', r.join(' | ') || '(none)');
}
for (const q of ['hi there', 'write me a poem about the sea', 'thanks!']) { const r = searchHandbook(q, 2); if (r.length) console.log('noise:', q, '→', r.map((x) => x.title).join(' | ')); }
console.log(`handbook ${ok}/${Q.length}`);

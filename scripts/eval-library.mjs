// node scripts/eval-library.mjs <packDir>  — recall@1/@3 + latency for the Library pack
import fs from 'fs';
import path from 'path';
import { createLibrary, definitionTarget } from '../components/libsearch.js';

const dir = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
let bytesRead = 0;
const lib = createLibrary({ manifest, readText: async (rel) => { const s = fs.readFileSync(path.join(dir, rel), 'utf8'); bytesRead += s.length; return s; } });

const Q = [
  ['how fast does light travel', ['Speed of light']], ['who was abraham lincoln', ['Abraham Lincoln']], ['what is photosynthesis', ['Photosynthesis']],
  ['pythagorean theorem', ['Pythagorean theorem']], ['what is the capital of france', ['Paris', 'France']], ['how do volcanoes form', ['Volcano']],
  ['causes of world war 1', ['World War I']], ['what does the heart do', ['Heart']], ['quadratic equation', ['Quadratic equation']],
  ['who painted the mona lisa', ['Mona Lisa', 'Leonardo da Vinci']], ['what is dna', ['DNA']], ['mitochondria function', ['Mitochondrion']],
  ['what is gravity', ['Gravity']], ['french revolution', ['French Revolution']], ['who wrote romeo and juliet', ['Romeo and Juliet', 'William Shakespeare']],
  ['what is democracy', ['Democracy']], ['water cycle', ['Water cycle']], ['what is an atom', ['Atom']], ['periodic table', ['Periodic table']],
  ['black holes', ['Black hole']], ['the great depression', ['Great Depression']], ['what is inflation in economics', ['Inflation']],
  ['how does the immune system work', ['Immune system']], ['tallest mountain in the world', ['Mount Everest']], ['amazon river', ['Amazon River']],
  ['what is a prime number', ['Prime number']], ['who discovered penicillin', ['Penicillin', 'Alexander Fleming']], ['what is climate change', ['Climate change', 'Global warming']],
  ['electoral college', ['Electoral College', 'United States Electoral College']], ['civil rights movement', ['Civil rights movement', 'African-American civil rights movement']],
  ['what is the cold war', ['Cold War']], ['ancient egypt pyramids', ['Egyptian pyramids', 'Ancient Egypt', 'Pyramid']], ['martin luther king', ['Martin Luther King Jr.', 'Martin Luther King, Jr.']],
  ['what is evolution', ['Evolution']], ['newton laws of motion', ["Newton's laws of motion"]], ['what is a noun', ['Noun']],
  ['solar system planets', ['Solar System', 'Planet']], ['the moon', ['Moon']], ['what is an earthquake', ['Earthquake']],
  ['what is the constitution of the united states', ['Constitution of the United States', 'United States Constitution']], ['industrial revolution', ['Industrial Revolution']],
  ['what is electricity', ['Electricity']], ['who was napoleon', ['Napoleon', 'Napoleon Bonaparte', 'Napoleon I of France']], ['what is a cell in biology', ['Cell (biology)', 'Cell']],
  ['renaissance', ['Renaissance']], ['what is algebra', ['Algebra']], ['roman empire', ['Roman Empire']], ['what is the internet', ['Internet']],
  ['the human brain', ['Brain', 'Human brain']], ['what causes the seasons', ['Season']], ['what is a molecule', ['Molecule']],
  ['albert einstein', ['Albert Einstein']], ['what is friction', ['Friction']], ['the holocaust', ['The Holocaust', 'Holocaust']],
  ['what is a hurricane', ['Tropical cyclone', 'Hurricane']], ['what is osmosis', ['Osmosis']], ['the bill of rights', ['United States Bill of Rights', 'Bill of Rights']],
  ['what is a metaphor', ['Metaphor']], ['what is energy', ['Energy']], ['what are vitamins', ['Vitamin']],
];
let r1 = 0, r3 = 0; const fails = []; const times = [];
for (const [q, want] of Q) {
  const t0 = performance.now();
  const res = await lib.search(q, 3);
  times.push(performance.now() - t0);
  const titles = res.map((r) => r.title);
  const w = want.map((x) => x.toLowerCase());
  if (titles[0] && w.includes(titles[0].toLowerCase())) r1++;
  if (titles.some((t) => w.includes(t.toLowerCase()))) r3++; else fails.push(`${q} → ${titles.join(' | ') || '(none)'}`);
}
times.sort((a, b) => a - b);
console.log(`recall@1 ${r1}/${Q.length}  recall@3 ${r3}/${Q.length}  median ${times[times.length >> 1].toFixed(1)} ms  p90 ${times[Math.floor(times.length * 0.9)].toFixed(1)} ms  MB read ${(bytesRead / 1048576).toFixed(1)}`);
fails.forEach((f) => console.log('  miss:', f));
for (const w of ['define photosynthesis', 'what does ephemeral mean', 'meaning of running']) {
  const tgt = definitionTarget(w); const d = tgt && await lib.define(tgt);
  console.log(w, '→', d ? `${d.word}: ${String(d.definition).slice(0, 90)}` : 'none');
}

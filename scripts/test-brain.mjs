// node scripts/test-brain.mjs  — unit tests for components/brain.js
import { evaluate, calc, isPureMath, route, buildPrompt, parseThink, formatNumber, mathAnswer } from '../components/brain.js';

let fail = 0, pass = 0;
const eq = (name, got, want) => {
  const ok = typeof want === 'number' ? Math.abs(got - want) < 1e-9 * Math.max(1, Math.abs(want)) : got === want;
  if (ok) pass++; else { fail++; console.log('FAIL', name, '→ got', got, 'want', want); }
};

eq('add', evaluate('2+3*4'), 14);
eq('parens', evaluate('(2+3)*4'), 20);
eq('pow right-assoc', evaluate('2^3^2'), 512);
eq('neg pow', evaluate('-2^2'), -4);
eq('sqrt', evaluate('sqrt(144)'), 12);
eq('unicode', evaluate('12 × 7 ÷ 3'), 28);
eq('implicit', evaluate('2(3+4)'), 14);
eq('pi', evaluate('2pi'), 2 * Math.PI);
eq('factorial', evaluate('5!'), 120);
eq('percent', evaluate('50%'), 0.5);
eq('sin deg', evaluate('sin(30)'), 0.5);
eq('squared word', evaluate('9 squared'), 81);
eq('commas', evaluate('1,000*3'), 3000);
eq('div', evaluate('7/2'), 3.5);
eq('bad', evaluate('2+'), null);
eq('words', evaluate('hello'), null);
eq('sci', evaluate('1.5e3*2'), 3000);

eq('calc in sentence', calc('what is 23*47 exactly?').value, 1081);
eq('calc pct', calc('what is 15% of 80').value, 12);
eq('calc x', calc('how much is 12 x 12').value, 144);
eq('calc sqrt words', calc('square root of 81').value, 9);
eq('calc none', calc('who was abraham lincoln'), null);
eq('calc date ignored', calc('my birthday is 3/14'), null);

eq('mixed pct', calc('what is 23*47 + 15% of 80?').value, 1093);
eq('pure mixed', isPureMath('what is 23*47 + 15% of 80?'), true);
eq('mathAnswer pct', mathAnswer(calc('15% of 80')).startsWith('**15% of 80 = 12**'), true);
eq('pure 1', isPureMath('what is 23*47?'), true);
eq('pure 2', isPureMath('15% of 80'), true);
eq('pure 3', isPureMath('sqrt(2)'), true);
eq('pure no', isPureMath('if I have 3 apples and buy 4 more how many'), false);
eq('pure no2', isPureMath('explain photosynthesis'), false);

eq('route math', route('12*12').kind, 'math');
eq('route reason', route('why is the sky blue').think, true);
eq('route write', route('write an email to my teacher').kind, 'write');
eq('route fast', route('why is the sky blue', 'fast').think, false);
eq('route deep', route('hello', 'deep').think, true);
eq('route fact', route('who painted the mona lisa').kind, 'fact');

const p = buildPrompt({ text: 'speed of light?', refs: [{ title: 'Speed of light', text: 'c is 299,792,458 m/s' }], canToggleThinking: true, think: false });
eq('prompt refs', p.includes('[1] Speed of light'), true);
eq('prompt nothink', p.endsWith('/no_think'), true);
eq('prompt plain', buildPrompt({ text: 'hi' }), 'hi');

eq('think split', parseThink('<think>hmm</think>\n\nAnswer').answer, 'Answer');
eq('think open', parseThink('<think>still').think, 'still');
eq('format', formatNumber(1081), '1,081');
eq('format frac', formatNumber(1 / 3), '0.3333333333');
eq('mathAnswer', mathAnswer(calc('23*47')).startsWith('**23 × 47 = 1,081**'), true);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

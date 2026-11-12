/* Aria's "brain" — pure JavaScript, no React / native imports, so it is unit
   tested under Node (scripts/test-brain.mjs).

   Small on-device models are bad at arithmetic and forget facts. This module
   does the parts plain code does perfectly:
   - calc():      exact calculator for expressions found in a message
   - route():     decide how to answer (instant math, quick, or deep thinking)
   - buildPrompt(): one well-structured prompt with verified numbers and
                  reference excerpts, so the model reports facts instead of
                  guessing them. */

/* ── exact calculator ─────────────────────────────────────────────────── */

const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
  sin: (d) => Math.sin((d * Math.PI) / 180), cos: (d) => Math.cos((d * Math.PI) / 180), tan: (d) => Math.tan((d * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI, acos: (x) => (Math.acos(x) * 180) / Math.PI, atan: (x) => (Math.atan(x) * 180) / Math.PI,
  round: Math.round, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

function normalize(src) {
  return String(src)
    .replace(/[×✕✖]/g, '*').replace(/[÷]/g, '/').replace(/[−–—]/g, '-')
    .replace(/\*\*/g, '^').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')            // 1,000 → 1000
    .replace(/(\d[\d.]*)\s*(?:%|percent)\s+of\s+/gi, '$1/100*') // 15% of 80 → 15/100*80
    .replace(/(\d)\s*x\s*(?=[\d(])/gi, '$1*')        // 3 x 4 → 3*4
    .replace(/\bsquare root of\b/gi, 'sqrt').replace(/\bcube root of\b/gi, 'cbrt')
    .replace(/\btimes\b|\bmultiplied by\b/gi, '*').replace(/\bdivided by\b|\bover\b/gi, '/')
    .replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-').replace(/\bto the power of\b/gi, '^')
    .replace(/\bsquared\b/gi, '^2').replace(/\bcubed\b/gi, '^3');
}

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'e' && /[-+0-9]/.test(s[j + 1] || '') && /\d/.test(s[j + 1] === '-' || s[j + 1] === '+' ? s[j + 2] || '' : s[j + 1])) {
        j += s[j + 1] === '-' || s[j + 1] === '+' ? 2 : 1; while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const v = Number(s.slice(i, j)); if (!isFinite(v)) return null;
      out.push({ t: 'num', v }); i = j; continue;
    }
    if (/[a-zπ]/i.test(c)) {
      let j = i; while (j < s.length && /[a-zπ]/i.test(s[j])) j++;
      const w = s.slice(i, j).toLowerCase();
      if (FUNCS[w]) out.push({ t: 'fn', v: w });
      else if (CONSTS[w] !== undefined) out.push({ t: 'num', v: CONSTS[w], c: true });
      else return null;
      i = j; continue;
    }
    if ('+-*/^()%!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    return null;
  }
  return out;
}

// Recursive-descent parser: expr := term (('+'|'-') term)*, etc.
function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (v) => { const k = tokens[p]; if (k && k.t === 'op' && k.v === v) { p++; return true; } return false; };
  function primary() {
    const k = peek();
    if (!k) throw 0;
    if (k.t === 'num') { p++; return k.v; }
    if (k.t === 'fn') {
      p++;
      const arg = eat('(') ? (() => { const v = expr(); if (!eat(')')) throw 0; return v; })() : unary();
      return FUNCS[k.v](arg);
    }
    if (eat('(')) { const v = expr(); if (!eat(')')) throw 0; return v; }
    throw 0;
  }
  function postfix() {
    let v = primary();
    for (;;) {
      if (eat('!')) { if (v < 0 || v > 170 || v !== Math.floor(v)) throw 0; let f = 1; for (let i = 2; i <= v; i++) f *= i; v = f; continue; }
      if (eat('%')) { v = v / 100; continue; }
      // implicit multiplication: 2(3), 2pi, (2)(3)
      const k = peek();
      const prev = tokens[p - 1];
      if (k && (k.t === 'fn' || (k.t === 'op' && k.v === '(') || (k.t === 'num' && (k.c || (prev && prev.t === 'op' && prev.v === ')'))))) { v *= power(); continue; }
      return v;
    }
  }
  function power() { const b = postfix(); if (eat('^')) return Math.pow(b, unary()); return b; }
  function unary() { if (eat('-')) return -unary(); if (eat('+')) return unary(); return power(); }
  function term() { let v = unary(); for (;;) { if (eat('*')) v *= unary(); else if (eat('/')) v /= unary(); else return v; } }
  function expr() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
  const v = expr();
  if (p !== tokens.length) throw 0;
  return v;
}

export function evaluate(src) {
  const toks = tokenize(normalize(src));
  if (!toks || !toks.length) return null;
  try { const v = parse(toks); return typeof v === 'number' && isFinite(v) ? v : null; } catch (e) { return null; }
}

export function formatNumber(v) {
  if (!isFinite(v)) return String(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toLocaleString('en-US');
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-6 || a >= 1e15)) return v.toExponential(6).replace(/\.?0+e/, 'e');
  const r = Number(v.toPrecision(12));
  return r.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

// Pull a calculation out of a natural-language message.
export function calc(text) {
  const raw = String(text || '');
  const norm = normalize(raw);
  // Longest run of math-looking characters that contains a digit and an operator.
  const runs = norm.match(/(?:\b(?:sqrt|cbrt|asin|acos|atan|sin|cos|tan|log|ln|abs|exp|pi)\b|[0-9.()+\-*/^%!π\s])+/gi) || [];
  let best = null;
  for (const r0 of runs) {
    const r = r0.trim().replace(/^[+*/^%)\s]+|[+\-*/^(\s]+$/g, '');
    if (!/\d/.test(r) || !/[+\-*/^!%]|sqrt|cbrt|sin|cos|tan|log|ln|abs/i.test(r.replace(/^-/, ''))) continue;
    if (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(r)) continue; // looks like a date
    const v = evaluate(r);
    if (v === null) continue;
    if (!best || r.length > best.expr.length) best = { expr: r, value: v, display: formatNumber(v) };
  }
  return best;
}

// True when the whole message is just a calculation ("what's 23*47?").
export function isPureMath(text) {
  const t = String(text || '').toLowerCase()
    .replace(/^(hey|hi|ok|so|please|aria)[,!\s]+/g, '')
    .replace(/^(what('|’)?s|what is|whats|calculate|compute|evaluate|solve|work out|how much is|find)\s+/, '')
    .replace(/[?=.!\s]+$/, '').trim();
  if (!t) return false;
  const c = calc(t);
  if (!c) return false;
  const leftover = normalize(t).replace(c.expr, '').replace(/[\s?=.]/g, '');
  return leftover.length === 0;
}

/* ── routing ──────────────────────────────────────────────────────────── */

const DEEP_RE = /\b(why|how come|prove|derive|explain (?:how|why|step)|step[- ]by[- ]step|solve|show (?:your|the) work|word problem|compare|analy[sz]e|reason|figure out|what would happen|if .* then|calculate|equation|integral|derivative|probability|how many|how much|essay|argue|plan)\b/i;
const WRITE_RE = /\b(write|draft|rewrite|reword|summari[sz]e|proofread|translate|email|letter|poem|story|essay|caption|paragraph|outline)\b/i;

/**
 * Decide how to answer.
 * mode: 'auto' | 'deep' | 'fast'  (user preference)
 * returns { kind: 'math'|'write'|'reason'|'fact'|'chat', think: boolean, maxTokens }
 */
export function route(text, mode = 'auto') {
  const t = String(text || '').trim();
  let kind = 'chat';
  if (isPureMath(t)) kind = 'math';
  else if (WRITE_RE.test(t)) kind = 'write';
  else if (DEEP_RE.test(t) || t.length > 220) kind = 'reason';
  else if (/^(who|what|when|where|which|define|meaning of|tell me about|explain)\b/i.test(t) || /\?$/.test(t)) kind = 'fact';
  let think = kind === 'reason';
  if (mode === 'deep') think = kind !== 'math';
  if (mode === 'fast') think = false;
  const maxTokens = think ? 1536 : kind === 'write' ? 900 : kind === 'chat' ? 400 : 700;
  return { kind, think, maxTokens };
}

/* ── prompt building ──────────────────────────────────────────────────── */

export const SYSTEM_PROMPT =
  'You are Aria, a brilliant, warm assistant that runs privately on the user\'s device with no internet. ' +
  'Answer the actual question first, directly and correctly, then add only the detail that helps. ' +
  'Use short paragraphs, bullet points for lists, and **bold** for the key answer. ' +
  'For math and science, show the key steps and give units. ' +
  'When reference notes or verified calculations are provided, trust them over your memory. ' +
  'If you are not sure about something, say so plainly instead of inventing facts.';

/**
 * Build the message sent to the model.
 * opts: { text, refs: [{title, text}], calc: {expr, display}|null, think: boolean,
 *         canToggleThinking: boolean, kind }
 */
export function buildPrompt({ text, refs = [], calc: c = null, think = false, canToggleThinking = false, kind = 'chat' }) {
  const parts = [];
  if (refs.length) {
    parts.push('Reference notes (from Aria\'s offline library — accurate, use them when relevant, do not mention them):');
    refs.forEach((r, i) => parts.push(`[${i + 1}] ${r.title}: ${String(r.text).replace(/\s+/g, ' ').trim()}`));
    parts.push('');
  }
  if (c) {
    parts.push(`Verified calculation (exact, from a calculator — use this value, do not recompute): ${c.expr} = ${c.display}`);
    parts.push('');
  }
  if (parts.length) parts.push('Question: ' + text);
  else parts.push(text);
  if (kind === 'write') parts.push('\n(Write it well: clear, natural, and ready to use.)');
  let msg = parts.join('\n');
  if (canToggleThinking) msg += think ? ' /think' : ' /no_think';
  return msg;
}

/* ── thinking output ──────────────────────────────────────────────────── */

// Qwen3 reasons inside <think>…</think>; split it from the answer.
export function parseThink(s) {
  if (!s) return { think: '', answer: '' };
  const close = s.indexOf('</think>');
  if (close !== -1) {
    let think = s.slice(0, close);
    const open = think.indexOf('<think>');
    if (open !== -1) think = think.slice(open + 7);
    return { think: think.trim(), answer: s.slice(close + 8).replace(/^\s+/, '') };
  }
  const open = s.indexOf('<think>');
  if (open !== -1) return { think: s.slice(open + 7).replace(/^\s+/, ''), answer: '' };
  return { think: '', answer: s };
}

// Instant, exact answer for a pure calculation — no model needed.
export function mathAnswer(c) {
  const pretty = c.expr.replace(/(\d[\d.]*)\/100\*/g, '$1% of ').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  return `**${pretty} = ${c.display}**\n\nCalculated exactly on your device.`;
}

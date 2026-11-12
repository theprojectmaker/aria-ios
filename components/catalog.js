/* Aria's Model Library. Each entry maps to a react-native-executorch registry
   model (resolved lazily so the web preview never touches the native module).
   Sizes are approximate download sizes of the 4-bit (8da4w) builds.
   `think` = the model supports Qwen3-style /think and /no_think switches. */

export const MODEL_CATALOG = [
  { id: 'qwen3-0.6b', key: 'QWEN3_0_6B', name: 'Aria Swift', base: 'Qwen3 0.6B', size: '0.5 GB', ram: 3, think: true,
    pitch: 'Fastest. Quick answers on any device.', tags: ['Fast'] },
  { id: 'qwen3-1.7b', key: 'QWEN3_1_7B', name: 'Aria', base: 'Qwen3 1.7B', size: '1.2 GB', ram: 4, think: true,
    pitch: 'The everyday default. Smart, quick, thinks when it helps.', tags: ['Recommended'] },
  { id: 'qwen3-4b', key: 'QWEN3_4B', name: 'Aria Pro', base: 'Qwen3 4B', size: '2.6 GB', ram: 6, think: true,
    pitch: 'Most knowledgeable. Best for hard questions and homework.', tags: ['Smartest'] },
  { id: 'phi4-mini', key: 'PHI4_MINI', name: 'Phi-4 mini', base: 'Microsoft Phi-4 mini · 3.8B', size: '2.5 GB', ram: 6, think: false,
    pitch: 'Strong at math and step-by-step reasoning.', tags: ['Math'] },
  { id: 'llama3.2-3b', key: 'LLAMA3_2_3B', name: 'Llama 3.2', base: 'Meta Llama 3.2 · 3B', size: '2.2 GB', ram: 6, think: false,
    pitch: 'Natural writing, emails, stories and rewrites.', tags: ['Writing'] },
  { id: 'qwen2.5-3b', key: 'QWEN2_5_3B', name: 'Qwen 2.5', base: 'Qwen2.5 3B Instruct', size: '2.0 GB', ram: 6, think: false,
    pitch: 'Direct answers without a thinking phase.', tags: ['Direct'] },
  { id: 'smollm2-360m', key: 'SMOLLM2_360M', name: 'Aria Lite', base: 'SmolLM2 360M', size: '0.3 GB', ram: 2, think: false,
    pitch: 'Tiny fallback for older devices. Simple chat only.', tags: ['Tiny'] },
];

export const AUTO = { id: 'auto', name: 'Automatic', pitch: 'Picks the best model your device can run, and steps down if it runs out of memory.' };

// Legacy pref values from 1.0 → catalog ids.
const LEGACY = { light: 'qwen3-0.6b', balanced: 'qwen3-1.7b', smart: 'qwen3-4b' };
export function normalizeModelPref(p) { return LEGACY[p] || p || 'auto'; }

export function catalogEntry(id) { return MODEL_CATALOG.find((m) => m.id === id) || null; }

// Resolve a catalog entry to the executorch config object (or null).
export function resolveConfig(models, entry) {
  const g = models && models.llm && models.llm[entry.key];
  return (g && (g.DEFAULT || g.XNNPACK_8DA4W)) || null;
}

/* Fallback chain for a preference: the chosen model first, then progressively
   smaller ones. Out-of-memory surfaces as an error and Chat drops one rung. */
export function chainIds(pref) {
  const p = normalizeModelPref(pref);
  const ladder = ['qwen3-4b', 'qwen3-1.7b', 'qwen3-0.6b', 'smollm2-360m'];
  if (p === 'auto') return ['qwen3-1.7b', 'qwen3-0.6b', 'smollm2-360m'];
  const i = ladder.indexOf(p);
  if (i >= 0) return ladder.slice(i);
  return [p, 'qwen3-1.7b', 'qwen3-0.6b', 'smollm2-360m'];
}

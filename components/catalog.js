/* Aria's Model Library. Each entry maps to a react-native-executorch registry
   model (resolved lazily so the web preview never touches the native module).
   Sizes are the measured download sizes of the builds iOS uses (MLX 4-bit).
   `think` = the model supports Qwen3-style /think and /no_think switches. */

export const MODEL_CATALOG = [
  { id: 'qwen3-0.6b', key: 'QWEN3_0_6B', name: 'Aria Swift', base: 'Qwen3 0.6B', size: '0.6 GB', ram: 3, think: true, group: 'Aria',
    pitch: 'Fastest. Quick answers on any device.', tags: ['Fast'] },
  { id: 'qwen3-1.7b', key: 'QWEN3_1_7B', name: 'Aria', base: 'Qwen3 1.7B', size: '1.5 GB', ram: 4, think: true, group: 'Aria',
    pitch: 'The everyday default. Smart, quick, thinks when it helps.', tags: ['Recommended'] },
  { id: 'qwen3-4b', key: 'QWEN3_4B', name: 'Aria Pro', base: 'Qwen3 4B', size: '2.9 GB', ram: 6, think: true, group: 'Aria',
    pitch: 'Most knowledgeable. Best for hard questions and homework.', tags: ['Smartest'] },
  { id: 'smollm2-360m', key: 'SMOLLM2_360M', name: 'Aria Lite', base: 'SmolLM2 360M', size: '0.5 GB', ram: 2, think: false, group: 'Aria',
    pitch: 'Tiny fallback for older devices. Simple chat only.', tags: ['Tiny'] },

  { id: 'gemma4-e2b', key: 'GEMMA4_E2B', name: 'Gemma 4', base: 'Google Gemma 4 · E2B', size: '2.9 GB', ram: 6, think: false, group: 'Large',
    pitch: 'Google’s newest small model. Clear explanations and strong general knowledge.', tags: ['New'] },
  { id: 'phi4-mini', key: 'PHI4_MINI', name: 'Phi-4 mini', base: 'Microsoft Phi-4 mini · 3.8B', size: '3.3 GB', ram: 6, think: false, group: 'Large',
    pitch: 'Strong at math and step-by-step reasoning.', tags: ['Math'] },
  { id: 'llama3.2-3b', key: 'LLAMA3_2_3B', name: 'Llama 3.2', base: 'Meta Llama 3.2 · 3B', size: '2.5 GB', ram: 6, think: false, group: 'Large',
    pitch: 'Natural writing, emails, stories and rewrites.', tags: ['Writing'] },
  { id: 'qwen2.5-3b', key: 'QWEN2_5_3B', name: 'Qwen 2.5', base: 'Qwen2.5 3B Instruct', size: '2.3 GB', ram: 6, think: false, group: 'Large',
    pitch: 'Direct answers without a thinking phase.', tags: ['Direct'] },

  { id: 'lfm2.5-1.2b', key: 'LFM2_5_1_2B', name: 'Liquid LFM2.5', base: 'Liquid AI LFM2.5 · 1.2B', size: '0.9 GB', ram: 3, think: false, group: 'Compact',
    pitch: 'Very fast replies in a small download. Good for quick back-and-forth.', tags: ['Quick'] },
  { id: 'qwen2.5-1.5b', key: 'QWEN2_5_1_5B', name: 'Qwen 2.5 Small', base: 'Qwen2.5 1.5B Instruct', size: '1.3 GB', ram: 4, think: false, group: 'Compact',
    pitch: 'Straight to the answer, and good in many languages.', tags: ['Languages'] },
  { id: 'llama3.2-1b', key: 'LLAMA3_2_1B', name: 'Llama 3.2 Small', base: 'Meta Llama 3.2 · 1B', size: '1.2 GB', ram: 3, think: false, group: 'Compact',
    pitch: 'Summaries and rewrites on devices with less memory.', tags: ['Summaries'] },
  { id: 'smollm2-1.7b', key: 'SMOLLM2_1_7B', name: 'SmolLM2', base: 'Hugging Face SmolLM2 · 1.7B', size: '2.0 GB', ram: 4, think: false, group: 'Compact',
    pitch: 'Trained on educational text. Friendly for study questions.', tags: ['Study'] },
];

export const MODEL_GROUPS = [
  { key: 'Aria', title: 'Aria', note: 'Tuned for this app. These can think before they answer.' },
  { key: 'Large', title: 'Large models', note: 'Best answers. Need a recent iPhone or iPad with 6 GB of memory or more.' },
  { key: 'Compact', title: 'Compact models', note: 'Smaller downloads that run on most devices.' },
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

/* Automatic model choice: the smartest model already on the device that has
   not failed here before (out-of-memory is remembered per model). With
   nothing downloaded yet, start with the everyday default. */
export const AUTO_LADDER = ['qwen3-4b', 'gemma4-e2b', 'phi4-mini', 'qwen3-1.7b', 'llama3.2-3b', 'qwen2.5-3b', 'smollm2-1.7b', 'qwen2.5-1.5b', 'lfm2.5-1.2b', 'llama3.2-1b', 'qwen3-0.6b', 'smollm2-360m'];
export function autoPick(downloaded = [], failed = []) {
  const ok = (id) => downloaded.includes(id) && !failed.includes(id);
  return AUTO_LADDER.find(ok) || (failed.includes('qwen3-1.7b') ? 'qwen3-0.6b' : 'qwen3-1.7b');
}
// Chain for a chat: its locked model (or the automatic pick), then smaller
// fallbacks so an out-of-memory model still leaves the chat working.
export function chainFor(chatModel, globalPref, downloaded = [], failed = []) {
  const first = chatModel && chatModel !== 'auto' ? chatModel
    : (globalPref && normalizeModelPref(globalPref) !== 'auto' ? normalizeModelPref(globalPref) : autoPick(downloaded, failed));
  const rest = ['qwen3-1.7b', 'qwen3-0.6b', 'smollm2-360m'].filter((id) => id !== first && !failed.includes(id));
  return [first, ...rest];
}

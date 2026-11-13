/* Web preview: simulated model manager so the Models page can be seen here. */
import { useEffect, useState } from 'react';

let state = { status: { 'qwen3-1.7b': { state: 'ready', progress: 1 }, 'qwen3-0.6b': { state: 'ready', progress: 1 } }, failed: [], loaded: true };
const subs = new Set();
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };
const setOne = (id, v) => set({ status: { ...state.status, [id]: { ...(state.status[id] || {}), ...v } } });
const timers = {};

export async function refreshModels() {}
export async function downloadModel(id) {
  setOne(id, { state: 'downloading', progress: 0 });
  timers[id] = setInterval(() => {
    const p = Math.min(1, (state.status[id].progress || 0) + 0.07);
    setOne(id, { progress: p });
    if (p >= 1) { clearInterval(timers[id]); setOne(id, { state: 'ready' }); }
  }, 150);
}
export function cancelModel(id) { clearInterval(timers[id]); setOne(id, { state: 'none', progress: 0 }); }
export async function deleteModel(id) { setOne(id, { state: 'none', progress: 0 }); }
export async function markFailed() {}
export async function clearFailed() {}
export function downloadedIds() { return Object.keys(state.status).filter((k) => state.status[k].state === 'ready'); }
export function modelsSnapshot() { return state; }
export function useModels() {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); return () => subs.delete(setS); }, []);
  return s;
}
export const MODELS_NATIVE = false;

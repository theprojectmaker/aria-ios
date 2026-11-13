/* Model manager: what's on the device, download (with progress + cancel),
   delete, and per-model "failed here" flags that steer Automatic away from
   models this device can't run. Uses executorch's public download() so files
   land exactly where the engine looks for them. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MODEL_CATALOG, resolveConfig } from './catalog';

const FAILED_KEY = 'aria.models.failed.v1';
let RNB = null;
const blob = () => (RNB || (RNB = require('react-native-blob-util').default || require('react-native-blob-util')));
const ex = () => require('react-native-executorch');

// Mirrors executorch's cache naming (fetcher.js: djb2(url) + basename).
const djb2 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h ^ s.charCodeAt(i)) >>> 0; return h; };
const cacheDir = () => `${blob().fs.dirs.DocumentDir}/react-native-executorch`;
const pathFor = (url) => { const u = url.split('?')[0]; return `${cacheDir()}/${djb2(u)}_${u.split('/').pop() || 'model'}`; };
const urlsOf = (cfg) => [cfg.modelPath, cfg.tokenizerPath, cfg.tokenizerConfigPath].filter((u) => typeof u === 'string' && /^https?:/.test(u));

let state = { status: {}, failed: [], loaded: false }; // status[id] = {state:'none'|'downloading'|'ready', progress}
const subs = new Set();
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };
const setOne = (id, v) => set({ status: { ...state.status, [id]: { ...(state.status[id] || {}), ...v } } });
const controllers = {};

export async function refreshModels() {
  const status = {};
  for (const m of MODEL_CATALOG) {
    const cfg = resolveConfig(ex().models, m);
    if (!cfg) continue;
    let all = true;
    for (const u of urlsOf(cfg)) {
      try { const st = await blob().fs.stat(pathFor(u)); if (!(Number(st.size) > 0)) all = false; } catch (e) { all = false; }
    }
    const cur = state.status[m.id];
    status[m.id] = cur && cur.state === 'downloading' ? cur : { state: all ? 'ready' : 'none', progress: all ? 1 : 0 };
  }
  let failed = [];
  try { failed = JSON.parse((await AsyncStorage.getItem(FAILED_KEY)) || '[]'); } catch (e) {}
  set({ status, failed, loaded: true });
}

export async function downloadModel(id) {
  const m = MODEL_CATALOG.find((x) => x.id === id);
  const cfg = m && resolveConfig(ex().models, m);
  if (!cfg || (state.status[id] && state.status[id].state === 'downloading')) return;
  const ctrl = new AbortController();
  controllers[id] = ctrl;
  setOne(id, { state: 'downloading', progress: 0, error: '' });
  try {
    await ex().download(cfg, { signal: ctrl.signal, onProgress: (p) => setOne(id, { progress: p }) });
    setOne(id, { state: 'ready', progress: 1 });
    await clearFailed(id);
  } catch (e) {
    setOne(id, { state: 'none', progress: 0, error: ctrl.signal.aborted ? '' : String((e && e.message) || e) });
  } finally { delete controllers[id]; }
}

export function cancelModel(id) { if (controllers[id]) controllers[id].abort(); }

export async function deleteModel(id) {
  const m = MODEL_CATALOG.find((x) => x.id === id);
  const cfg = m && resolveConfig(ex().models, m);
  if (!cfg) return;
  // Tokenizers are shared between sizes of the same family — keep them if another downloaded model uses them.
  const inUse = new Set();
  for (const o of MODEL_CATALOG) {
    if (o.id === id || !state.status[o.id] || state.status[o.id].state !== 'ready') continue;
    const oc = resolveConfig(ex().models, o); if (oc) urlsOf(oc).forEach((u) => inUse.add(u));
  }
  for (const u of urlsOf(cfg)) if (!inUse.has(u)) await blob().fs.unlink(pathFor(u)).catch(() => {});
  setOne(id, { state: 'none', progress: 0 });
}

export async function markFailed(id) {
  if (state.failed.includes(id)) return;
  const failed = [...state.failed, id];
  set({ failed });
  await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failed)).catch(() => {});
}
export async function clearFailed(id) {
  if (!state.failed.includes(id)) return;
  const failed = state.failed.filter((x) => x !== id);
  set({ failed });
  await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failed)).catch(() => {});
}

export function downloadedIds() { return Object.keys(state.status).filter((k) => state.status[k].state === 'ready'); }
export function modelsSnapshot() { return state; }

export function useModels() {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); if (!state.loaded) refreshModels(); return () => subs.delete(setS); }, []);
  return s;
}
export const MODELS_NATIVE = true;

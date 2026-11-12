/* The downloadable offline Library (~75 MB: 79k Simple English Wikipedia
   articles + 86k Webster's dictionary entries). Files are fetched once from
   the aria-ios GitHub release into Documents/aria-library/v1 with
   react-native-blob-util (already in the binary — executorch uses it), then
   searched shard-by-shard by libsearch.js, so almost nothing sits in RAM. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLibrary } from './libsearch';

const BASE = 'https://github.com/theprojectmaker/aria-ios/releases/download/library-v1/';
const KEY = 'aria.library.v1';
const flat = (rel) => rel.replace('/', '-');

let RNB = null;
const blob = () => (RNB || (RNB = require('react-native-blob-util').default || require('react-native-blob-util')));
const dir = () => `${blob().fs.dirs.DocumentDir}/aria-library/v1`;

let state = { status: 'none', progress: 0, bytes: 0, total: 0, error: '', docs: 0 };
let lib = null;
let cancelled = false;
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f(state)); };

async function openLibrary() {
  const fs = blob().fs;
  const manifest = JSON.parse(await fs.readFile(`${dir()}/manifest.json`, 'utf8'));
  lib = createLibrary({ manifest, readText: (rel) => fs.readFile(`${dir()}/${flat(rel)}`, 'utf8') });
  set({ status: 'ready', progress: 1, docs: manifest.docs, total: manifest.bytes });
}

export async function initLibrary() {
  try {
    if ((await AsyncStorage.getItem(KEY)) === 'ready' && (await blob().fs.exists(`${dir()}/manifest.json`))) await openLibrary();
  } catch (e) { set({ status: 'none' }); }
}

export async function downloadLibrary() {
  if (state.status === 'downloading') return;
  cancelled = false;
  const fs = blob().fs;
  set({ status: 'downloading', progress: 0, bytes: 0, error: '' });
  try {
    await fs.mkdir(dir()).catch(() => {});
    const get = async (name, dest) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await blob().config({ path: dest, fileCache: true }).fetch('GET', BASE + name);
          const code = res.info().status;
          if (code >= 200 && code < 300) return;
          throw new Error('HTTP ' + code);
        } catch (e) { if (attempt === 2) throw e; }
      }
    };
    const mpath = `${dir()}/manifest.json.tmp`;
    await get('manifest.json', mpath);
    const manifest = JSON.parse(await fs.readFile(mpath, 'utf8'));
    let done = 0;
    for (const f of manifest.files) {
      if (cancelled) throw new Error('cancelled');
      const dest = `${dir()}/${flat(f.name)}`;
      let have = false;
      try { const st = await fs.stat(dest); have = Number(st.size) === f.bytes; } catch (e) {}
      if (!have) await get(flat(f.name), dest);
      done += f.bytes;
      set({ bytes: done, total: manifest.bytes, progress: done / manifest.bytes });
    }
    await fs.mv(mpath, `${dir()}/manifest.json`).catch(async () => { await fs.unlink(`${dir()}/manifest.json`).catch(() => {}); await fs.mv(mpath, `${dir()}/manifest.json`); });
    await AsyncStorage.setItem(KEY, 'ready');
    await openLibrary();
  } catch (e) {
    set({ status: cancelled ? 'none' : 'error', error: cancelled ? '' : String((e && e.message) || e) });
  }
}

export function cancelLibrary() { cancelled = true; }

export async function deleteLibrary() {
  cancelled = true;
  lib = null;
  await AsyncStorage.removeItem(KEY).catch(() => {});
  await blob().fs.unlink(`${blob().fs.dirs.DocumentDir}/aria-library`).catch(() => {});
  set({ status: 'none', progress: 0, bytes: 0, docs: 0 });
}

export function libraryReady() { return !!lib && state.status === 'ready'; }
export async function librarySearch(q, k = 2) { if (!lib) return []; try { return await lib.search(q, k); } catch (e) { return []; } }
export async function libraryDefine(w) { if (!lib) return null; try { return await lib.define(w); } catch (e) { return null; } }

export function useLibrary() {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); return () => subs.delete(setS); }, []);
  return s;
}
export const LIBRARY_AVAILABLE = true;

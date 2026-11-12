/* Web preview: the downloadable Library only exists in the installed app.
   This stub lets Settings show the Library card with a simulated download. */
import { useEffect, useState } from 'react';

let state = { status: 'none', progress: 0, bytes: 0, total: 78 * 1048576, error: '', docs: 0 };
const subs = new Set();
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };
let timer = null;

export async function initLibrary() {}
export async function downloadLibrary() {
  if (state.status === 'downloading') return;
  set({ status: 'downloading', progress: 0, bytes: 0 });
  timer = setInterval(() => {
    const p = Math.min(1, state.progress + 0.05);
    set({ progress: p, bytes: p * state.total });
    if (p >= 1) { clearInterval(timer); set({ status: 'ready', docs: 79055 }); }
  }, 120);
}
export function cancelLibrary() { clearInterval(timer); set({ status: 'none', progress: 0 }); }
export async function deleteLibrary() { set({ status: 'none', progress: 0, docs: 0 }); }
export function libraryReady() { return false; }
export async function librarySearch() { return []; }
export async function libraryDefine() { return null; }
export function useLibrary() {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); return () => subs.delete(setS); }, []);
  return s;
}
export const LIBRARY_AVAILABLE = false;

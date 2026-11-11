import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

/* Tiny global preferences store (theme + model), backed by AsyncStorage.
   Components subscribe via usePrefs() and re-render when a pref changes. */
let state = { theme: 'system', model: 'auto', knowledge: 'on' };
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export async function loadPrefs() {
  try {
    const [th, md, kn] = await Promise.all([
      AsyncStorage.getItem('aria.pref.theme'),
      AsyncStorage.getItem('aria.pref.model'),
      AsyncStorage.getItem('aria.pref.knowledge'),
    ]);
    const next = { ...state };
    if (th) next.theme = th;
    if (md) next.model = md;
    if (kn) next.knowledge = kn;
    state = next;
    emit();
  } catch (e) {}
}

export function getPrefs() { return state; }

export function setTheme(v) {
  state = { ...state, theme: v };
  AsyncStorage.setItem('aria.pref.theme', v).catch(() => {});
  emit();
}

export function setModelPref(v) {
  state = { ...state, model: v };
  AsyncStorage.setItem('aria.pref.model', v).catch(() => {});
  emit();
}

export function setKnowledge(v) {
  state = { ...state, knowledge: v };
  AsyncStorage.setItem('aria.pref.knowledge', v).catch(() => {});
  emit();
}

export function usePrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    subs.add(l);
    return () => subs.delete(l);
  }, []);
  return state;
}

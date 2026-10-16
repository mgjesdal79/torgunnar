import { defaultState, migrate, mergeState } from './logic.js';

const ROOM = (location.hash.match(/r=([\w-]+)/) || [])[1] || 'local';
const KEY = 'torgunnar:' + ROOM;
const OLD_KEY = 'pandacoins:' + ROOM; // migrering: les gammel data hvis ny mangler

export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return nowIso().slice(0, 10); }
export function newId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadState() {
  let local = defaultState();
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (raw) local = mergeState(defaultState(), JSON.parse(raw));
  } catch (e) { /* korrupt cache → default */ }
  return migrate(local, todayIso());
}

let saveTimer = null;
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
export function saveStateDebounced(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 400);
}

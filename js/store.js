import { defaultState, migrate, mergeState } from './logic.js';

// index.html definerer window.EDGE_FUNCTION_URL (tom streng = ren localStorage-modus).
const EDGE = () => (window.EDGE_FUNCTION_URL || '').trim();
// Publishable/anon-nøkkel – må sendes på hvert Edge Function-kall (Supabase-gateway).
// Public-safe (ligger i all Supabase-frontend); settes i index.html.
const ANON = () => (window.SUPABASE_ANON_KEY || '').trim();
function edgeHeaders() {
  const h = { 'content-type': 'application/json' };
  const k = ANON();
  if (k) { h.apikey = k; h.Authorization = 'Bearer ' + k; }
  return h;
}

// ÉN fast, delt datakilde – samme innhold uansett enhet/nettleser/URL.
// Bevisst hash-uavhengig: en stray #r=... kan ikke splitte dataene i et eget rom.
// Ikke-gjettbar romkode: app-URL-en + denne koden er «nøkkelen» til dataene.
export const ROOM = 'tg-fb6fd95a-7707-4a9a-911f-e96c74a323ec-c2a67df1';

const KEY = 'torgunnar:' + ROOM;
// Engangs-migrering: eldre installasjoner lagret under disse nøklene (før fast romkode).
// Leses kun hvis den nye nøkkelen er tom, så notatene følger med over.
const LEGACY_KEYS = ['torgunnar:local', 'pandacoins:local'];

export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return nowIso().slice(0, 10); }
export function newId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- lokal cache ----
function loadLocal() {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    }
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveLocal(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

// ---- remote (Edge Function) ----
async function loadRemote() {
  if (!EDGE()) return null;
  try {
    const r = await fetch(EDGE(), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ room: ROOM, action: 'load' }),
    });
    const j = await r.json();
    return j.data || null;
  } catch (e) { return null; }
}
async function saveRemote(state) {
  if (!EDGE()) return false;
  try {
    const r = await fetch(EDGE(), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ room: ROOM, action: 'save', data: state }),
    });
    return (await r.json()).ok === true;
  } catch (e) { return false; }
}

// Lokal cache + remote, flettet. Alltid en gyldig state ut.
export async function loadState() {
  const local = loadLocal() || defaultState();
  const remote = await loadRemote();
  const merged = migrate(mergeState(local, remote), todayIso());
  saveLocal(merged);
  return merged;
}

// Debounce-lagring (400 ms remote). Lokal cache skrives umiddelbart.
let saveTimer = null;
export function saveStateDebounced(state) {
  saveLocal(state);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveRemote(state), 400);
}
export function saveState(state) {
  saveLocal(state);
  saveRemote(state);
}

// Polling: hent remote, flett inn. Kall applyMerged KUN når skyen hadde noe nytt,
// så vi ikke tegner om (og stjeler fokus) under egne endringer.
export function startPolling(getState, applyMerged, intervalMs = 5000) {
  if (!EDGE()) return;
  setInterval(async () => {
    const remote = await loadRemote();
    if (!remote) return;
    const current = JSON.stringify(getState());
    const merged = mergeState(getState(), remote);
    if (JSON.stringify(merged) !== current) {
      saveLocal(merged);
      applyMerged(merged);
    }
  }, intervalMs);
}

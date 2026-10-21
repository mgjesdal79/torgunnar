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

// ---- romkode (den EKTE nøkkelen til dataene) ----
// Koden ligger IKKE i utsendt kode lenger – den tastes inn på låseskjermen og
// lagres kun lokalt på enheten. Rommet (og dermed Supabase-raden) utledes av koden,
// så uten riktig kode kan ingen bygge riktig forespørsel → ingen ser dataene.
const CODE_KEY = 'torgunnar:code';
// Normaliser: små bokstaver, bare a-z0-9 → «ABCD-EFGH» og «abcdefgh» gir samme rom.
function normCode(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function getCode() {
  try { return (localStorage.getItem(CODE_KEY) || '').trim(); } catch (e) { return ''; }
}
export function setCode(code) {
  try { localStorage.setItem(CODE_KEY, (code || '').trim()); } catch (e) {}
}
export function clearCode() {
  try { localStorage.removeItem(CODE_KEY); } catch (e) {}
}
export function hasCode() { return normCode(getCode()) !== ''; }
// Rommet utledes av koden. Ingen kode => tomt rom (appen er låst).
export function getRoom() {
  const c = normCode(getCode());
  return c ? 'tgc-' + c : '';
}

const localKey = () => 'torgunnar:' + getRoom();
// Engangs-migrering: eldre installasjoner lagret under disse nøklene (før romkode).
// Leses KUN hvis den nye nøkkelen er tom, så notatene følger med over.
const LEGACY_LOCAL_KEYS = [
  'torgunnar:tg-fb6fd95a-7707-4a9a-911f-e96c74a323ec-c2a67df1',
  'torgunnar:local',
  'pandacoins:local',
];
// Det gamle faste rommet i skya (før romkode). Hentes KUN som del av migreringen
// for enheter som allerede hadde TorGunnar-data lokalt – aldri for en ny/feil kode,
// så en tilfeldig kode kan ikke arve de gamle notatene.
const LEGACY_REMOTE_ROOM = 'tg-fb6fd95a-7707-4a9a-911f-e96c74a323ec-c2a67df1';

export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return nowIso().slice(0, 10); }
export function newId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- lokal cache ----
// Returnerer { state, legacy } – legacy=true når vi falt tilbake på en gammel nøkkel
// (dvs. denne enheten hadde data fra før romkoden).
function loadLocalRaw() {
  try {
    const cur = localStorage.getItem(localKey());
    if (cur) return { state: JSON.parse(cur), legacy: false };
    for (const k of LEGACY_LOCAL_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw) return { state: JSON.parse(raw), legacy: true };
    }
  } catch (e) {}
  return { state: null, legacy: false };
}
function saveLocal(state) {
  try { localStorage.setItem(localKey(), JSON.stringify(state)); } catch (e) {}
}

// ---- remote (Edge Function) ----
async function loadRemoteRoom(room) {
  if (!EDGE() || !room) return null;
  try {
    const r = await fetch(EDGE(), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ room, action: 'load' }),
    });
    const j = await r.json();
    return j.data || null;
  } catch (e) { return null; }
}
function loadRemote() { return loadRemoteRoom(getRoom()); }
async function saveRemote(state) {
  if (!EDGE() || !getRoom()) return false;
  try {
    const r = await fetch(EDGE(), {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ room: getRoom(), action: 'save', data: state }),
    });
    return (await r.json()).ok === true;
  } catch (e) { return false; }
}

// Lokal cache + remote, flettet. Alltid en gyldig state ut.
export async function loadState() {
  const { state: localState, legacy } = loadLocalRaw();
  const local = localState || defaultState();
  let remote = await loadRemote();
  // Engangs-migrering fra gammelt fast rom – KUN for enheter som allerede hadde
  // TorGunnar-data lokalt (hindrer at en tilfeldig/feil kode arver de gamle notatene).
  if (legacy) {
    const old = await loadRemoteRoom(LEGACY_REMOTE_ROOM);
    if (old) remote = mergeState(remote || defaultState(), old);
  }
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
  if (!EDGE() || !getRoom()) return;
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

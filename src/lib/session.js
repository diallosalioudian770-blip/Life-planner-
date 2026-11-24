// Boot sequence: local database, optional Supabase account, sync loop.
import { useSyncExternalStore } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { createStore, setStore } from './store.js';
import { seedEntries } from './defaults.js';
import { createSync, getClient } from './sync.js';
import { startNotifier } from './notify.js';

const KEY = 'lp-data-v1';
// IndexedDB is the main local database. If the app is closed in the few
// milliseconds before an IndexedDB write completes, a synchronous emergency copy
// in localStorage is used on next start, so no change is lost.
const EMERGENCY = 'lp-emergency';
const storage = {
  async load() {
    const snap = await idbGet(KEY);
    let em = null;
    try { em = JSON.parse(localStorage.getItem(EMERGENCY) || 'null'); } catch { /* ignore */ }
    if (em?.data && (!snap || (em.savedAt || 0) > (snap.savedAt || 0))) {
      await idbSet(KEY, em);
      localStorage.removeItem(EMERGENCY);
      return em;
    }
    localStorage.removeItem(EMERGENCY);
    return snap;
  },
  save: (snap) => idbSet(KEY, JSON.parse(JSON.stringify(snap))),
};
function emergencySave() {
  if (!store?.unsaved) return;
  try { localStorage.setItem(EMERGENCY, JSON.stringify(store.snapshot())); } catch { /* quota: IndexedDB write still in flight */ }
}

let state = { ready: false, user: null, mode: null, sync: { state: 'local' }, configured: false, error: null };
const listeners = new Set();
const set = (p) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
export const useSession = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export const getSession = () => state;

let store;
let engine;

function seed() {
  const recs = store.putMany(seedEntries());
  store.setMeta({ seeded: Object.fromEntries(recs.map((r, i) => [seedEntries()[i][0] + '/' + r.id, r.updatedAt])) });
}

export async function boot() {
  store = createStore(storage);
  setStore(store);
  let had = false;
  try { had = await store.load(); } catch (e) { set({ error: "Impossible d'ouvrir la base locale : " + e.message }); }
  if (!had || !store.get('settings', 'main')) seed();
  window.addEventListener('pagehide', () => { emergencySave(); store.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { emergencySave(); store.flush(); } else engine?.sync(); });
  startNotifier(store);

  const wasRecovery = /type=recovery/.test(location.hash + location.search);
  const sb = getClient();
  const localMode = localStorage.getItem('lp:mode') === 'local';
  set({ configured: !!sb });
  if (!sb) { set({ ready: true, mode: 'local', sync: { state: 'local' } }); return; }

  engine = createSync(store, () => (state.user ? sb : null), { onStatus: (s) => set({ sync: s }) });
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) await onSignedIn(data.session.user);
  else set({ ready: true, mode: localMode ? 'local' : null });
  if (wasRecovery && data?.session) set({ recovery: true });

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user && session.user.id !== state.user?.id) onSignedIn(session.user);
    if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
    if (event === 'SIGNED_OUT') set({ user: null, mode: null, sync: { state: 'local' } });
  });
  setInterval(() => engine.sync(), 30000);
  window.addEventListener('online', () => engine.sync());
  window.addEventListener('offline', () => set({ sync: { ...state.sync, state: 'offline' } }));
  let t;
  store.subscribe(() => { if (state.user && store.pendingCount()) { clearTimeout(t); t = setTimeout(() => engine.sync(), 1500); } });
}

async function onSignedIn(user) {
  const sb = getClient();
  const meta = store.meta;
  if (meta.ownerId && meta.ownerId !== user.id) {
    store.reset();
    store.setMeta({ ownerId: user.id, lastPull: null });
  } else if (!meta.ownerId) {
    // First sign-in on this device. Untouched default records must not
    // overwrite the account's real data, so only modified records stay dirty.
    const { count } = await sb.from('records').select('id', { count: 'exact', head: true });
    if (count) {
      const seeded = meta.seeded || {};
      const keep = {};
      for (const [k, stamp] of Object.entries(meta.dirty)) if (seeded[k] !== stamp) keep[k] = stamp;
      store.setMeta({ dirty: keep });
    } else store.markAllDirty();
    store.setMeta({ ownerId: user.id, lastPull: null });
  }
  localStorage.removeItem('lp:mode');
  set({ user, mode: 'account', ready: true });
  await engine.sync();
  if (!store.get('settings', 'main')) seed(); // brand-new account
}

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const redirect = () => location.origin + location.pathname;
export async function signIn(email, password) {
  const { error } = await getClient().auth.signInWithPassword({ email: cleanEmail(email), password });
  if (error) throw new Error(translateAuth(error.message));
}
export async function signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email: cleanEmail(email), password, options: { emailRedirectTo: redirect() } });
  if (error) throw new Error(translateAuth(error.message));
  return !data.session; // true = e-mail confirmation required
}
export async function resetPassword(email) {
  const { error } = await getClient().auth.resetPasswordForEmail(cleanEmail(email), { redirectTo: redirect() });
  if (error) throw new Error(translateAuth(error.message));
}
export async function updatePassword(password) {
  const { error } = await getClient().auth.updateUser({ password });
  if (error) throw new Error(translateAuth(error.message));
  set({ recovery: false });
}
export const endRecovery = () => set({ recovery: false });
export async function resendConfirmation(email) {
  const { error } = await getClient().auth.resend({ type: 'signup', email: cleanEmail(email), options: { emailRedirectTo: redirect() } });
  if (error) throw new Error(translateAuth(error.message));
}
export async function signOut() {
  await store.flush();
  await getClient()?.auth.signOut();
  store.reset();
  seed();
  store.setMeta({ ownerId: null, lastPull: null, dirty: {} });
  set({ user: null, mode: null, sync: { state: 'local' } });
}
export function useLocalOnly() {
  localStorage.setItem('lp:mode', 'local');
  set({ mode: 'local', ready: true });
}
export const syncNow = () => engine?.sync();

function translateAuth(m) {
  if (/Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect. Si tu n'as jamais confirmé ton compte, ou si tu n'es pas sûre qu'il existe, crée-le à nouveau ou utilise « Mot de passe oublié ».";
  if (/rate limit|too many|security purposes/i.test(m)) return "Trop d'e-mails ou de tentatives en peu de temps. Attends quelques minutes puis réessaie.";
  if (/sending.*email|smtp/i.test(m)) return "Supabase n'a pas réussi à envoyer l'e-mail.";
  if (/same.*password|different from the old/i.test(m)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/Email not confirmed/i.test(m)) return "NOT_CONFIRMED";
  if (/already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse.';
  if (/Password should be/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/fetch/i.test(m)) return 'Connexion impossible : vérifie ta connexion Internet.';
  return m;
}

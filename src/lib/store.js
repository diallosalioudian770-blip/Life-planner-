// Single source of truth for all planner data.
// Every record lives in a collection, carries `id` and `updatedAt`, and is never
// hard-deleted locally until synced: deletions are tombstones (`deleted: true`)
// so that other devices learn about them.

import { useSyncExternalStore } from 'react';

export const COLLECTIONS = [
  'settings', 'items', 'occ', 'subjects', 'grades', 'goals', 'habits', 'habitLogs', 'sleep',
  'journal', 'routines', 'routineLogs', 'meals', 'transactions', 'savings', 'projects', 'jobs',
  'languages', 'vocab', 'books', 'lists', 'logs', 'reviews', 'workoutTemplates',
];

export function uid(prefix = '') {
  const rnd = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
  return prefix + rnd.replace(/-/g, '').slice(0, 16);
}

export function createStore(storage) {
  let data = emptyData();
  let meta = { dirty: {}, ownerId: null, lastPull: null };
  let version = 0;
  let saveTimer = null;
  const listeners = new Set();

  function emptyData() {
    return Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
  }

  function emit() {
    version++;
    listeners.forEach((l) => l());
  }

  let unsaved = false;
  function scheduleSave() {
    unsaved = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 30);
  }

  async function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!storage) return;
    const snap = { data, meta, savedAt: Date.now() };
    await storage.save(snap);
    if (snap.data === data) unsaved = false;
  }

  async function load() {
    const snap = storage ? await storage.load() : null;
    if (snap?.data) {
      data = { ...emptyData(), ...snap.data };
      meta = { dirty: {}, ownerId: null, lastPull: null, ...snap.meta };
    }
    emit();
    return !!snap?.data;
  }

  function get(coll, id) {
    const r = data[coll]?.[id];
    return r && !r.deleted ? r : undefined;
  }

  function list(coll) {
    return Object.values(data[coll] || {}).filter((r) => !r.deleted);
  }

  function put(coll, rec) {
    if (!COLLECTIONS.includes(coll)) throw new Error('Collection inconnue : ' + coll);
    const id = rec.id || uid();
    const prev = data[coll][id];
    const next = { ...(prev && !prev.deleted ? prev : {}), ...rec, id, updatedAt: Date.now() };
    delete next.deleted;
    data = { ...data, [coll]: { ...data[coll], [id]: next } };
    meta.dirty[coll + '/' + id] = next.updatedAt;
    scheduleSave();
    emit();
    return next;
  }

  function putMany(entries) {
    // entries: [coll, rec][] — one emit for bulk operations
    const out = [];
    for (const [coll, rec] of entries) {
      const id = rec.id || uid();
      const prev = data[coll][id];
      const next = { ...(prev && !prev.deleted ? prev : {}), ...rec, id, updatedAt: Date.now() };
      if (!rec.deleted) delete next.deleted;
      data = { ...data, [coll]: { ...data[coll], [id]: next } };
      meta.dirty[coll + '/' + id] = next.updatedAt;
      out.push(next);
    }
    scheduleSave();
    emit();
    return out;
  }

  function remove(coll, id) {
    if (!data[coll]?.[id]) return;
    const next = { id, deleted: true, updatedAt: Date.now() };
    data = { ...data, [coll]: { ...data[coll], [id]: next } };
    meta.dirty[coll + '/' + id] = next.updatedAt;
    scheduleSave();
    emit();
  }

  // ---- sync helpers ----
  function dirtyRecords() {
    return Object.keys(meta.dirty).map((key) => {
      const i = key.indexOf('/');
      const coll = key.slice(0, i);
      const id = key.slice(i + 1);
      return { key, collection: coll, id, record: data[coll]?.[id], stamp: meta.dirty[key] };
    }).filter((d) => d.record);
  }

  function markClean(entries) {
    for (const e of entries) {
      if (meta.dirty[e.key] === e.stamp) delete meta.dirty[e.key];
    }
    scheduleSave();
    emit();
  }

  function applyRemote(rows) {
    // rows: {collection, id, data, deleted}
    let changed = false;
    for (const row of rows) {
      if (!COLLECTIONS.includes(row.collection)) continue;
      const key = row.collection + '/' + row.id;
      if (meta.dirty[key]) continue; // local edit pending: it will win on next push
      const rec = row.deleted ? { id: row.id, deleted: true, updatedAt: row.data?.updatedAt || Date.now() } : { ...row.data, id: row.id };
      data = { ...data, [row.collection]: { ...data[row.collection], [row.id]: rec } };
      changed = true;
    }
    if (changed) {
      scheduleSave();
      emit();
    }
  }

  function markAllDirty() {
    for (const coll of COLLECTIONS) {
      for (const [id, rec] of Object.entries(data[coll])) meta.dirty[coll + '/' + id] = rec.updatedAt || Date.now();
    }
    scheduleSave();
  }

  function reset() {
    data = emptyData();
    meta = { dirty: {}, ownerId: null, lastPull: null };
    scheduleSave();
    emit();
  }

  function exportJSON() {
    const out = {};
    for (const c of COLLECTIONS) out[c] = list(c);
    return { app: 'life-planner', version: 1, exportedAt: new Date().toISOString(), data: out };
  }

  function importJSON(json) {
    if (!json || json.app !== 'life-planner' || !json.data) throw new Error('Fichier de sauvegarde invalide.');
    const entries = [];
    for (const c of COLLECTIONS) for (const rec of json.data[c] || []) entries.push([c, rec]);
    putMany(entries);
    return entries.length;
  }

  return {
    load, flush, get, list, put, putMany, remove, reset, exportJSON, importJSON,
    dirtyRecords, markClean, applyRemote, markAllDirty,
    get meta() { return meta; },
    get unsaved() { return unsaved; },
    snapshot: () => ({ data, meta, savedAt: Date.now() }),
    setMeta(patch) { meta = { ...meta, ...patch }; scheduleSave(); emit(); },
    get raw() { return data; },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    getVersion: () => version,
    pendingCount: () => Object.keys(meta.dirty).length,
  };
}

// ---- app singleton ----
let storeInstance = null;
export function setStore(s) { storeInstance = s; }
export const store = new Proxy({}, { get: (_, k) => storeInstance[k] });

export function useStore(selector = (s) => s) {
  useSyncExternalStore(storeInstance.subscribe, storeInstance.getVersion);
  return selector(storeInstance);
}

export function useVersion() {
  return useSyncExternalStore(storeInstance.subscribe, storeInstance.getVersion);
}

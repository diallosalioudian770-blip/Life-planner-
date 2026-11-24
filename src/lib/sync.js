// Real cloud sync with Supabase (auth + Postgres with row-level security).
// If Supabase is not configured the app runs in local-only mode and says so:
// nothing here pretends to sync.

import { createClient } from '@supabase/supabase-js';

const LS_KEY = 'lp:supabase';

export function getSupabaseConfig() {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey, source: 'env' };
  try {
    const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (c?.url && c?.key) return { ...c, source: 'local' };
  } catch { /* ignore */ }
  return null;
}

export function saveSupabaseConfig(url, key) {
  if (!url) localStorage.removeItem(LS_KEY);
  else localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
}

let client = null;
export function getClient() {
  if (client) return client;
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

const TABLE = 'records';
const PAGE = 500;

// Generic engine (client injectable for tests).
export function createSync(store, getSb, { onStatus = () => {} } = {}) {
  let running = null;
  let status = { state: 'idle', error: null, lastSync: null };
  const set = (p) => { status = { ...status, ...p }; onStatus(status); };

  async function push(sb) {
    const dirty = store.dirtyRecords();
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200);
      const rows = chunk.map((d) => ({ collection: d.collection, id: d.id, data: d.record, deleted: !!d.record.deleted }));
      const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,collection,id' });
      if (error) throw error;
      store.markClean(chunk);
    }
    return dirty.length;
  }

  async function pull(sb) {
    // overlap window protects against rows committed slightly out of order
    const since = store.meta.lastPull ? new Date(new Date(store.meta.lastPull).getTime() - 5 * 60000).toISOString() : '1970-01-01T00:00:00Z';
    let offset = 0;
    let maxSeen = store.meta.lastPull;
    let total = 0;
    for (;;) {
      const { data, error } = await sb.from(TABLE).select('collection,id,data,deleted,updated_at').gt('updated_at', since)
        .order('updated_at', { ascending: true }).range(offset, offset + PAGE - 1);
      if (error) throw error;
      store.applyRemote(data);
      total += data.length;
      for (const r of data) if (!maxSeen || r.updated_at > maxSeen) maxSeen = r.updated_at;
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    if (maxSeen) store.setMeta({ lastPull: maxSeen });
    return total;
  }

  async function sync() {
    const sb = getSb();
    if (!sb) return;
    if (running) return running;
    running = (async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        set({ state: 'offline', error: null });
        return;
      }
      set({ state: 'syncing', error: null });
      try {
        const pushed = await push(sb);
        const pulled = await pull(sb);
        set({ state: store.pendingCount() ? 'pending' : 'ok', lastSync: new Date().toISOString(), error: null, pushed, pulled });
      } catch (e) {
        set({ state: 'error', error: e?.message || String(e) });
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return { sync, get status() { return status; } };
}

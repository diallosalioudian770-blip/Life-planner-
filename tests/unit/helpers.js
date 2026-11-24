import { createStore } from '../../src/lib/store.js';
import { seedEntries } from '../../src/lib/defaults.js';

export function memStorage() {
  let snap = null;
  return { load: async () => (snap ? JSON.parse(snap) : null), save: async (s) => { snap = JSON.stringify(s); }, get snap() { return snap; } };
}

export function seeded(storage = memStorage()) {
  const s = createStore(storage);
  s.putMany(seedEntries());
  return s;
}

// Minimal in-memory imitation of the Supabase query builder used by sync.js
export function fakeSupabase() {
  const table = new Map();
  let clock = 0;
  const ts = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString();
  const client = {
    table,
    from() {
      return {
        upsert: async (rows) => {
          for (const r of rows) table.set(r.collection + '/' + r.id, { ...structuredClone(r), updated_at: ts() });
          return { error: null };
        },
        select() {
          const q = { gtVal: null, a: 0, b: 1e9 };
          const b = {
            gt: (_c, v) => { q.gtVal = v; return b; },
            order: () => b,
            range: (x, y) => { q.a = x; q.b = y; return b; },
            then: (res) => {
              const rows = [...table.values()].filter((r) => !q.gtVal || r.updated_at > q.gtVal).sort((x, y) => (x.updated_at < y.updated_at ? -1 : 1)).slice(q.a, q.b + 1);
              return Promise.resolve({ data: structuredClone(rows), error: null }).then(res);
            },
          };
          return b;
        },
      };
    },
  };
  return client;
}

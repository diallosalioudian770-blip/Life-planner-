import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/lib/store.js';
import { createSync } from '../../src/lib/sync.js';
import { memStorage, seeded, fakeSupabase } from './helpers.js';
import { createItem, occurrences, setStatus } from '../../src/lib/recurrence.js';

describe('sauvegarde locale', () => {
  it('les données survivent à la fermeture (rechargement du stockage)', async () => {
    const storage = memStorage();
    const a = seeded(storage);
    createItem(a, { title: 'Persistante', date: '2026-11-24' });
    await a.flush();
    const b = createStore(storage);
    await b.load();
    expect(b.list('items').map((i) => i.title)).toEqual(['Persistante']);
    expect(b.list('subjects')).toHaveLength(7);
  });
  it('export / import JSON', () => {
    const a = seeded();
    createItem(a, { title: 'X', date: '2026-11-24' });
    const b = createStore(null);
    b.importJSON(JSON.parse(JSON.stringify(a.exportJSON())));
    expect(b.list('items')[0].title).toBe('X');
  });
});

describe('synchronisation entre deux appareils', () => {
  it('converge, propage modifications et suppressions', async () => {
    const sb = fakeSupabase();
    const mac = seeded();
    const iphone = createStore(null);
    const s1 = createSync(mac, () => sb);
    const s2 = createSync(iphone, () => sb);
    const it = createItem(mac, { title: 'Rendre le TP', date: '2026-11-27', type: 'echeance' });
    await s1.sync();
    expect(s1.status.state).toBe('ok');
    await s2.sync();
    expect(iphone.get('items', it.id).title).toBe('Rendre le TP');
    expect(iphone.list('subjects')).toHaveLength(7);
    // edit on phone
    setStatus(iphone, occurrences(iphone, '2026-11-27', '2026-11-27')[0], 'done', 30);
    await s2.sync();
    await s1.sync();
    expect(mac.get('items', it.id).status).toBe('done');
    // delete on mac
    mac.remove('items', it.id);
    await s1.sync();
    await s2.sync();
    expect(iphone.get('items', it.id)).toBeUndefined();
    expect(mac.pendingCount()).toBe(0);
  });
  it('erreur de synchronisation signalée et modifications conservées', async () => {
    const mac = seeded();
    const broken = { from: () => ({ upsert: async () => ({ error: { message: 'réseau indisponible' } }) }) };
    const s = createSync(mac, () => broken);
    await s.sync();
    expect(s.status.state).toBe('error');
    expect(s.status.error).toContain('réseau');
    expect(mac.pendingCount()).toBeGreaterThan(0);
  });
  it('une modification locale en attente n\'est pas écrasée par le serveur', async () => {
    const sb = fakeSupabase();
    const a = seeded();
    const b = createStore(null);
    const sa = createSync(a, () => sb), sbb = createSync(b, () => sb);
    const it = createItem(a, { title: 'v1', date: '2026-11-24' });
    await sa.sync(); await sbb.sync();
    a.put('items', { id: it.id, title: 'v2-mac' });
    await sa.sync();
    b.put('items', { id: it.id, title: 'v3-iphone' });
    await sbb.sync(); // pushes v3 first, then pulls
    expect(b.get('items', it.id).title).toBe('v3-iphone');
    await sa.sync();
    expect(a.get('items', it.id).title).toBe('v3-iphone');
  });
});

import { describe, it, expect } from 'vitest';
import { seeded } from './helpers.js';
import { createItem, occurrences, setStatus, moveOccurrence, updateOccurrence, deleteOccurrence } from '../../src/lib/recurrence.js';

describe('tâches simples', () => {
  it('ajout, modification, déplacement, suppression', () => {
    const s = seeded();
    const it1 = createItem(s, { title: 'Lire chapitre 3', categoryId: 'etudes', date: '2026-11-24', start: '14:00', durationMin: 60 });
    expect(occurrences(s, '2026-11-24', '2026-11-24').map((o) => o.title)).toEqual(['Lire chapitre 3']);
    updateOccurrence(s, occurrences(s, '2026-11-24', '2026-11-24')[0], { title: 'Lire chapitre 4', durationMin: 90 });
    expect(s.get('items', it1.id).title).toBe('Lire chapitre 4');
    moveOccurrence(s, occurrences(s, '2026-11-24', '2026-11-24')[0], '2026-11-26', '10:00', { postpone: true });
    expect(occurrences(s, '2026-11-24', '2026-11-24')).toHaveLength(0);
    const moved = occurrences(s, '2026-11-26', '2026-11-26')[0];
    expect(moved.start).toBe('10:00');
    expect(moved.postponed[0].from).toBe('2026-11-24');
    deleteOccurrence(s, moved);
    expect(occurrences(s, '2026-11-20', '2026-11-30')).toHaveLength(0);
  });
  it('une tâche programmée n\'est jamais terminée automatiquement', () => {
    const s = seeded();
    createItem(s, { title: 'Passée', date: '2020-01-01', durationMin: 30 });
    expect(occurrences(s, '2020-01-01', '2020-01-01')[0].status).toBe('todo');
  });
});

describe('activités récurrentes', () => {
  const mk = (s) => createItem(s, { title: 'Révision maths', categoryId: 'etudes', type: 'revision', date: '2026-11-02', start: '16:00', durationMin: 60, recur: { freq: 'weekly', interval: 1, days: [1, 3] } });
  it('génère les occurrences sans dupliquer (stockée une seule fois)', () => {
    const s = seeded();
    mk(s);
    const a = occurrences(s, '2026-11-01', '2026-11-30');
    const b = occurrences(s, '2026-11-01', '2026-11-30');
    expect(a.length).toBe(9); // lundis et mercredis du 2 au 30 novembre
    expect(b.length).toBe(a.length);
    expect(s.list('items')).toHaveLength(1);
  });
  it('statut terminé conservé par occurrence', () => {
    const s = seeded();
    mk(s);
    const o = occurrences(s, '2026-11-04', '2026-11-04')[0];
    setStatus(s, o, 'done', 45);
    const again = occurrences(s, '2026-11-01', '2026-11-30');
    expect(again.filter((x) => x.status === 'done').map((x) => x.date)).toEqual(['2026-11-04']);
    expect(again.find((x) => x.date === '2026-11-04').actualMin).toBe(45);
  });
  it('modifier uniquement cette occurrence', () => {
    const s = seeded();
    mk(s);
    const o = occurrences(s, '2026-11-09', '2026-11-09')[0];
    updateOccurrence(s, o, { start: '18:00', title: 'Révision maths (spéciale)' }, 'this');
    const all = occurrences(s, '2026-11-01', '2026-11-30');
    expect(all.filter((x) => x.start === '18:00').map((x) => x.date)).toEqual(['2026-11-09']);
    expect(all).toHaveLength(9);
  });
  it('modifier toutes les occurrences futures (scission de série)', () => {
    const s = seeded();
    mk(s);
    setStatus(s, occurrences(s, '2026-11-04', '2026-11-04')[0], 'done', 60);
    const o = occurrences(s, '2026-11-16', '2026-11-16')[0];
    updateOccurrence(s, o, { start: '20:00' }, 'future');
    const all = occurrences(s, '2026-11-01', '2026-11-30');
    expect(all).toHaveLength(9);
    expect(all.filter((x) => x.date < '2026-11-16').every((x) => x.start === '16:00')).toBe(true);
    expect(all.filter((x) => x.date >= '2026-11-16').every((x) => x.start === '20:00')).toBe(true);
    expect(all.find((x) => x.date === '2026-11-04').status).toBe('done');
  });
  it('déplacer une seule occurrence vers un autre jour', () => {
    const s = seeded();
    mk(s);
    const o = occurrences(s, '2026-11-09', '2026-11-09')[0];
    moveOccurrence(s, o, '2026-11-14', '11:00', { postpone: true });
    expect(occurrences(s, '2026-11-09', '2026-11-09')).toHaveLength(0);
    const m = occurrences(s, '2026-11-14', '2026-11-14');
    expect(m).toHaveLength(1);
    expect(m[0].start).toBe('11:00');
    // moved from outside the queried range
    expect(occurrences(s, '2026-11-13', '2026-11-15')).toHaveLength(1);
  });
  it('supprimer cette occurrence / les suivantes', () => {
    const s = seeded();
    mk(s);
    deleteOccurrence(s, occurrences(s, '2026-11-09', '2026-11-09')[0], 'this');
    expect(occurrences(s, '2026-11-01', '2026-11-30')).toHaveLength(8);
    deleteOccurrence(s, occurrences(s, '2026-11-18', '2026-11-18')[0], 'future');
    expect(occurrences(s, '2026-11-01', '2026-11-30').map((o) => o.date)).toEqual(['2026-11-02', '2026-11-04', '2026-11-11', '2026-11-16']);
  });
  it('récurrence quotidienne et mensuelle', () => {
    const s = seeded();
    createItem(s, { title: 'Hydratation', date: '2026-11-01', recur: { freq: 'daily', interval: 2 } });
    createItem(s, { title: 'Loyer', date: '2026-01-31', recur: { freq: 'monthly', interval: 1 } });
    const nov = occurrences(s, '2026-11-01', '2026-11-30');
    expect(nov.filter((o) => o.title === 'Hydratation')).toHaveLength(15);
    expect(occurrences(s, '2026-01-01', '2026-12-31').filter((o) => o.title === 'Loyer')).toHaveLength(7); // mois de 31 jours
  });
});

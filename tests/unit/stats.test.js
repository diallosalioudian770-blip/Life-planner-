import { describe, it, expect } from 'vitest';
import { seeded } from './helpers.js';
import { createItem, occurrences, setStatus } from '../../src/lib/recurrence.js';
import { rangeStats, studyStats, financeStats, habitStats, smartSummary } from '../../src/lib/stats.js';
import { suggestRevisions } from '../../src/lib/suggest.js';

describe('statistiques', () => {
  it('heures prévues distinctes des heures réelles, seules les tâches validées comptent', () => {
    const s = seeded();
    createItem(s, { title: 'Compta ch.1', categoryId: 'etudes', type: 'revision', subjectId: 'sub-compta', date: '2026-11-23', durationMin: 120 });
    createItem(s, { title: 'Maths ex.', categoryId: 'etudes', type: 'revision', subjectId: 'sub-maths', date: '2026-11-24', durationMin: 60, priority: 'haute' });
    setStatus(s, occurrences(s, '2026-11-23', '2026-11-23')[0], 'done', 90);
    s.put('logs', { date: '2026-11-25', minutes: 30, categoryId: 'etudes', subjectId: 'sub-maths' });
    const st = rangeStats(s, '2026-11-23', '2026-11-29', '2026-11-25');
    expect(st.totals.plannedMin).toBe(180);
    expect(st.totals.actualMin).toBe(120);
    expect(st.totals.tasksDone).toBe(1);
    expect(st.totals.missed).toBe(1);
    const study = studyStats(s, '2026-11-23', '2026-11-29');
    expect(study['sub-compta'].actualMin).toBe(90);
    expect(study['sub-maths'].actualMin).toBe(30);
    const lines = smartSummary(s, '2026-11-23', '2026-11-29', '2026-11-25', s.get('settings', 'main').categories);
    expect(lines.join(' ')).toContain('2 h');
    expect(lines.join(' ')).toContain('0 de tes 1 tâches prioritaires');
  });
  it('finances calculées uniquement depuis les opérations saisies', () => {
    const s = seeded();
    expect(financeStats(s, '2026-11-01', '2026-11-30').balance).toBeNull();
    s.put('settings', { id: 'main', finance: { ...s.get('settings', 'main').finance, initialBalance: 500, initialBalanceDate: '2026-11-01' } });
    s.put('transactions', { date: '2026-11-05', type: 'income', amount: 200, category: 'Autres' });
    s.put('transactions', { date: '2026-11-06', type: 'expense', amount: 42.5, category: 'Courses' });
    s.put('transactions', { date: '2026-11-07', type: 'saving', amount: 50 });
    const f = financeStats(s, '2026-11-01', '2026-11-30');
    expect(f.balance).toBeCloseTo(607.5);
    expect(f.expense).toBeCloseTo(42.5);
    expect(f.byCategory.Courses).toBeCloseTo(42.5);
    expect(f.savedTotal).toBe(50);
  });
  it('habitudes : taux de réalisation', () => {
    const s = seeded();
    const h = s.put('habits', { name: 'Lire 10 pages', kind: 'build', schedule: { type: 'daily' }, createdDate: '2026-11-23' });
    s.put('habitLogs', { id: `${h.id}@2026-11-23`, habitId: h.id, date: '2026-11-23', value: 1 });
    s.put('habitLogs', { id: `${h.id}@2026-11-24`, habitId: h.id, date: '2026-11-24', value: 1 });
    const st = habitStats(s, '2026-11-23', '2026-11-26');
    expect(st.done).toBe(2);
    expect(st.due).toBe(4);
  });
});

describe('suggestions de révision', () => {
  it('propose sans rien écrire, respecte les cours et alterne les matières', () => {
    const s = seeded();
    s.put('subjects', { id: 'sub-compta', weeklyGoalMin: 180 });
    s.put('subjects', { id: 'sub-maths', weeklyGoalMin: 120 });
    createItem(s, { title: 'Cours éco', type: 'cours', categoryId: 'etudes', date: '2026-11-30', start: '14:00', durationMin: 120 });
    const before = s.list('items').length;
    const { suggestions } = suggestRevisions(s, '2026-11-30', '2026-11-29');
    expect(s.list('items').length).toBe(before);
    expect(suggestions.length).toBeGreaterThan(0);
    const mon = suggestions.filter((x) => x.date === '2026-11-30');
    for (const x of mon) expect(x.start >= '16:10' || x.start < '13:50').toBe(true);
    const total = (id) => suggestions.filter((x) => x.subjectId === id).reduce((a, x) => a + x.durationMin, 0);
    expect(total('sub-compta')).toBe(Math.round(180 * 1.25));
    expect(total('sub-maths')).toBe(150);
    for (const day of new Set(suggestions.map((x) => x.date))) {
      const d = suggestions.filter((x) => x.date === day);
      expect(d.reduce((a, x) => a + x.durationMin, 0)).toBeLessThanOrEqual(180);
    }
  });
  it('rien à proposer sans objectif ni examen', () => {
    const s = seeded();
    const r = suggestRevisions(s, '2026-11-30', '2026-11-29');
    expect(r.suggestions).toHaveLength(0);
    expect(r.notes[0]).toContain('objectif');
  });
});

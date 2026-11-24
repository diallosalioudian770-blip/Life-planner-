import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save, Sparkles, CalendarClock, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { rangeStats, smartSummary, studyStats } from '../lib/stats.js';
import { addDays, startOfWeek, weekDays, today, fmtShort, weekKey, fmtHours, WEEKDAYS_SHORT } from '../lib/date.js';
import { PageHead, Progress, Ring, Empty, useCategories, toast } from '../components/ui.jsx';
import { openItemForm, deleteWithScope } from '../components/items.jsx';
import { moveOccurrence } from '../lib/recurrence.js';
import { PlanActualChart, Bars, Line } from '../components/charts.jsx';
import { goalsIn } from '../lib/stats.js';

export function weekSnapshot(from, categories) {
  const to = addDays(from, 6);
  const t = today();
  const st = rangeStats(store, from, to, t);
  return {
    week: weekKey(from), from, to,
    totals: { plannedMin: st.totals.plannedMin, actualMin: st.totals.actualMin, tasks: st.totals.tasks, tasksDone: st.totals.tasksDone, missed: st.totals.missed, postponed: st.totals.postponed },
    byCat: Object.fromEntries(Object.entries(st.byCat).map(([k, v]) => [k, { plannedMin: v.plannedMin, actualMin: v.actualMin, tasks: v.tasks, tasksDone: v.tasksDone, missed: v.missed }])),
    summary: smartSummary(store, from, to, t, categories),
  };
}

export default function WeekReview() {
  const [params, setParams] = useSearchParams();
  const from = startOfWeek(params.get('w') || today());
  const to = addDays(from, 6);
  const wk = weekKey(from);
  useStore();
  const cats = useCategories();
  const t = today();
  const st = rangeStats(store, from, to, t);
  const study = studyStats(store, from, to);
  const saved = store.get('reviews', 'week:' + wk);
  const [note, setNote] = useState(saved?.note || '');
  useEffect(() => { setNote(store.get('reviews', 'week:' + wk)?.note || ''); }, [wk]);
  const weekGoals = goalsIn(store, 'semaine', wk);
  const pct = st.totals.tasks ? st.totals.tasksDone / st.totals.tasks : 0;
  const nextMonday = addDays(from, 7);

  const history = Array.from({ length: 8 }, (_, i) => addDays(from, -7 * (7 - i))).map((w) => {
    const s = rangeStats(store, w, addDays(w, 6), t).totals;
    return { label: fmtShort(w), w, pct: s.tasks ? Math.round((s.tasksDone / s.tasks) * 100) : null, actual: s.actualMin / 60, planned: s.plannedMin / 60, tasks: s.tasks, done: s.tasksDone };
  });
  const savedList = store.list('reviews').filter((r) => r.kind === 'week').sort((a, b) => (a.id < b.id ? 1 : -1));

  const save = () => {
    store.put('reviews', { id: 'week:' + wk, kind: 'week', period: wk, note, snapshot: weekSnapshot(from, cats), savedAt: Date.now() });
    toast('Bilan enregistré dans ton historique.');
  };

  return (
    <div>
      <PageHead eyebrow="Bilan de la semaine" title={`Semaine du ${fmtShort(from)} au ${fmtShort(to)}`}>
        <Link className="btn" to={`/semaine?w=${from}`}><ArrowLeft size={16} />Semaine</Link>
        <button className="btn icon" aria-label="Semaine précédente" onClick={() => setParams({ w: addDays(from, -7) })}><ChevronLeft size={18} /></button>
        <button className="btn icon" aria-label="Semaine suivante" onClick={() => setParams({ w: addDays(from, 7) })}><ChevronRight size={18} /></button>
      </PageHead>

      <div className="card mb" style={{ background: 'linear-gradient(135deg, var(--surface), var(--rose-soft))' }}>
        <div className="card-head"><h3><Sparkles size={18} />Résumé</h3><span className="xs muted">Basé uniquement sur ce que tu as validé</span></div>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }} data-testid="smart-summary">
          {smartSummary(store, from, to, t, cats).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      <div className="grid g4 mb">
        <div className="card row" style={{ gap: 14 }}><Ring value={pct} size={64} /><div className="stat"><span className="stat-label">Progression globale</span><span className="small">{st.totals.tasksDone} / {st.totals.tasks} tâches</span></div></div>
        <div className="card stat"><span className="stat-label">Heures prévues</span><span className="stat-value">{fmtHours(st.totals.plannedMin)}</span></div>
        <div className="card stat"><span className="stat-label">Heures réellement effectuées</span><span className="stat-value">{fmtHours(st.totals.actualMin)}</span></div>
        <div className="card stat"><span className="stat-label">Restantes · reportées</span><span className="stat-value">{st.remaining.length} · {st.totals.postponed}</span></div>
      </div>

      <div className="grid g2 mb">
        <div className="card">
          <div className="card-head"><h3>Heures par catégorie</h3></div>
          {Object.keys(st.byCat).length ? <PlanActualChart groups={cats.filter((c) => st.byCat[c.id]).map((c) => ({ label: c.name, a: st.byCat[c.id].plannedMin / 60, b: st.byCat[c.id].actualMin / 60 }))} format={(v) => `${Math.round(v * 10) / 10}h`} /> : <Empty>Pas encore de données.</Empty>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Tâches validées par jour</h3></div>
          <Bars data={weekDays(from).map((d, i) => ({ label: WEEKDAYS_SHORT[i], value: st.occ.filter((o) => o.date === d && o.status === 'done' && o.isTask).length }))} name="Tâches validées par jour" />
        </div>
      </div>

      <div className="card mb">
        <div className="card-head"><h3>Objectifs et résultats par catégorie</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Catégorie</th><th>Objectifs</th><th>Temps prévu</th><th>Temps réel</th><th>Tâches</th><th>Réalisation</th><th>Non réalisées</th></tr></thead>
            <tbody>
              {cats.filter((c) => st.byCat[c.id] || weekGoals.some((g) => g.categoryId === c.id)).map((c) => {
                const x = st.byCat[c.id] || { plannedMin: 0, actualMin: 0, tasks: 0, tasksDone: 0, missed: 0 };
                const g = weekGoals.filter((g) => g.categoryId === c.id);
                return (
                  <tr key={c.id}>
                    <td><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: c.color }} />{c.name}</span></td>
                    <td>{g.length ? `${g.filter((x) => x.done).length}/${g.length} atteints` : '—'}</td>
                    <td>{fmtHours(x.plannedMin)}</td>
                    <td><strong>{fmtHours(x.actualMin)}</strong></td>
                    <td>{x.tasksDone}/{x.tasks}</td>
                    <td style={{ minWidth: 110 }}><Progress value={x.tasks ? x.tasksDone / x.tasks : 0} color={c.color} /></td>
                    <td>{x.missed || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.values(study).some((s) => s.plannedMin || s.actualMin) && (
          <div className="mt">
            <h4 className="mb" style={{ marginBottom: 8 }}>Études, par matière</h4>
            <PlanActualChart groups={store.list('subjects').filter((s) => study[s.id].plannedMin || study[s.id].actualMin || s.weeklyGoalMin).map((s) => ({ label: s.name, a: (s.weeklyGoalMin || study[s.id].plannedMin) / 60, b: study[s.id].actualMin / 60 }))} labels={['Objectif / prévu', 'Réalisé']} format={(v) => `${Math.round(v * 10) / 10}h`} />
          </div>
        )}
      </div>

      <div className="card mb" data-testid="unfinished">
        <div className="card-head"><h3><CalendarClock size={18} />Tâches non réalisées</h3><span className="small muted">Rien n'est reporté sans ton choix.</span></div>
        {st.remaining.length ? (
          <div className="list">
            {st.remaining.map((o) => (
              <div key={o.key} className="list-row" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}><div style={{ fontWeight: 500 }}>{o.title}</div><div className="xs muted">{fmtShort(o.date)}{o.start ? ' · ' + o.start : ''}</div></div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => { moveOccurrence(store, o, t > nextMonday ? t : nextMonday, o.start, { postpone: true }); toast('Reportée à la semaine prochaine.'); }}>Reporter à lundi</button>
                  <button className="btn sm" onClick={() => openItemForm({ occ: o })}><Pencil size={13} />Reprogrammer</button>
                  <button className="btn sm danger" onClick={() => deleteWithScope(o)}><Trash2 size={13} />Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty title="Rien en attente">Toutes les tâches de cette semaine sont validées.</Empty>}
      </div>

      <div className="grid g2 mb">
        <div className="card">
          <div className="card-head"><h3>Mes réflexions</h3></div>
          <textarea className="input" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce qui a bien marché, ce que je veux ajuster, ce dont je suis fière…" />
          <div className="row mt"><span className="xs muted" style={{ flex: 1 }}>{saved ? `Bilan enregistré le ${new Date(saved.savedAt).toLocaleDateString('fr-FR')}` : "L'enregistrement fige les chiffres de la semaine dans ton historique."}</span><button className="btn primary" onClick={save}><Save size={15} />Enregistrer le bilan</button></div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Comparer avec les semaines précédentes</h3></div>
          <Line data={history.map((h) => ({ label: h.label, value: h.pct }))} format={(v) => `${Math.round(v)}%`} name="Taux de réalisation des tâches" />
          <p className="xs muted center">Taux de tâches validées, 8 dernières semaines</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Historique</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Semaine</th><th>Heures prévues</th><th>Heures effectuées</th><th>Tâches</th><th>Bilan enregistré</th></tr></thead>
            <tbody>
              {[...history].reverse().map((h) => {
                const rec = store.get('reviews', 'week:' + weekKey(h.w));
                return (
                  <tr key={h.w} style={{ cursor: 'pointer' }} onClick={() => setParams({ w: h.w })}>
                    <td>{h.label}</td><td>{h.planned.toFixed(1)} h</td><td><strong>{h.actual.toFixed(1)} h</strong></td><td>{h.done}/{h.tasks}</td>
                    <td>{rec ? <span className="chip gold">Oui</span> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {savedList.length > 0 && (
          <details className="mt">
            <summary className="small" style={{ cursor: 'pointer' }}>Tous mes bilans enregistrés ({savedList.length})</summary>
            <div className="stack mt">
              {savedList.map((r) => (
                <div key={r.id} className="card flat" style={{ background: 'var(--surface-2)' }}>
                  <div className="row between"><strong>{r.period}</strong><span className="xs muted">{fmtHours(r.snapshot?.totals?.actualMin)} effectuées · {r.snapshot?.totals?.tasksDone}/{r.snapshot?.totals?.tasks} tâches</span></div>
                  {r.note && <p className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.note}</p>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

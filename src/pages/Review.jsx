import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save, Trophy, Compass } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { rangeStats, studyStats, habitStats, sportStats, financeStats, booksFinished, languageMinutes, euro, smartSummary, chapterProgress, gradeAverage } from '../lib/stats.js';
import { today, endOfMonth, addMonths, fmtMonth, fmtHours, monthKey, MONTHS, startOfWeek, ymd } from '../lib/date.js';
import { PageHead, Tabs, Empty, Progress, useCategories, toast } from '../components/ui.jsx';
import { PlanActualChart, Bars, HBars } from '../components/charts.jsx';

function analyse(from, to, cats) {
  const t = today();
  const end = to > t ? t : to;
  const st = rangeStats(store, from, to, t);
  const study = studyStats(store, from, to);
  const habits = habitStats(store, from, end < from ? from : end);
  const sport = sportStats(store, from, to, t);
  const fin = financeStats(store, from, to);
  const books = booksFinished(store, from, to);
  const lang = languageMinutes(store, from, to);
  const goals = store.list('goals');
  const goalsDone = goals.filter((g) => g.done && g.doneDate >= from && g.doneDate <= to);
  const goalsOpen = goals.filter((g) => !g.done && ((g.horizon === 'mois' && g.period >= from.slice(0, 7) && g.period <= to.slice(0, 7)) || (g.horizon === 'annee' && g.period === from.slice(0, 4))));
  const steps = store.list('projects').flatMap((p) => (p.steps || []).map((s) => ({ ...s, project: p.name })));
  const stepsDone = steps.filter((s) => s.done && s.doneDate >= from && s.doneDate <= to);
  const settings = store.get('settings', 'main');
  const months = Math.max(1, Math.round((new Date(to) - new Date(from)) / (30.4 * 86400000)));
  const budget = settings?.finance?.monthlyBudget ? settings.finance.monthlyBudget * months : null;

  const wins = [];
  const attention = [];
  for (const g of goalsDone) wins.push(`Objectif atteint : ${g.title}`);
  for (const s of store.list('subjects')) {
    const x = study[s.id];
    const weeks = Math.max(1, Math.round(((new Date(end) - new Date(from)) / 86400000 + 1) / 7));
    if (s.weeklyGoalMin) {
      const goal = s.weeklyGoalMin * weeks;
      if (x.actualMin >= goal) wins.push(`${s.name} : objectif de révision tenu (${fmtHours(x.actualMin)}).`);
      else if (x.actualMin < goal * 0.7) attention.push(`${s.name} : ${fmtHours(x.actualMin)} de révision sur ${fmtHours(goal)} visées.`);
    }
  }
  for (const h of habits.per) {
    if (h.rate != null && h.due >= 4 && h.rate >= 0.8) wins.push(`Habitude solide : ${h.habit.name} (${Math.round(h.rate * 100)} %).`);
    if (h.rate != null && h.due >= 4 && h.rate < 0.4) attention.push(`Habitude à soutenir : ${h.habit.name} (${Math.round(h.rate * 100)} %).`);
  }
  if (books.length) wins.push(`${books.length} livre${books.length > 1 ? 's' : ''} terminé${books.length > 1 ? 's' : ''}.`);
  if (sport.done) wins.push(`${sport.done} séance${sport.done > 1 ? 's' : ''} de sport validée${sport.done > 1 ? 's' : ''}.`);
  if (sport.missed) attention.push(`${sport.missed} séance(s) de sport non réalisée(s) : peut-être à adapter à tes disponibilités ?`);
  if (fin.saving > 0) wins.push(`${euro(fin.saving)} mis de côté.`);
  if (budget && fin.expense > budget) attention.push(`Dépenses (${euro(fin.expense)}) au-dessus du budget prévu (${euro(budget)}).`);
  const limits = settings?.finance?.limits || {};
  for (const [c, lim] of Object.entries(limits)) if (lim && fin.byCategory[c] > lim * months) attention.push(`Dépenses « ${c} » au-dessus de ta limite.`);
  for (const g of goalsOpen) attention.push(`Objectif encore ouvert : ${g.title}`);
  return { st, study, habits, sport, fin, books, lang, goalsDone, goalsOpen, stepsDone, wins, attention, budget, summary: smartSummary(store, from, to, t, cats) };
}

export default function Review() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('y') ? 'annee' : 'mois';
  const t = today();
  const month = params.get('m') || monthKey(t);
  const year = Number(params.get('y')) || Number(t.slice(0, 4));
  const from = mode === 'mois' ? month + '-01' : `${year}-01-01`;
  const to = mode === 'mois' ? endOfMonth(from) : `${year}-12-31`;
  const cats = useCategories();
  useStore();
  const a = analyse(from, to, cats);
  const id = mode === 'mois' ? 'month:' + month : 'year:' + year;
  const saved = store.get('reviews', id);
  const [note, setNote] = useState(saved?.note || '');
  useEffect(() => { setNote(store.get('reviews', id)?.note || ''); }, [id]);
  const subjects = store.list('subjects');
  const languages = store.list('languages');
  const finCats = Object.entries(a.fin.byCategory).sort((x, y) => y[1] - x[1]);
  const prev = () => setParams(mode === 'mois' ? { m: monthKey(addMonths(from, -1)) } : { y: String(year - 1) });
  const next = () => setParams(mode === 'mois' ? { m: monthKey(addMonths(from, 1)) } : { y: String(year + 1) });
  const savedList = store.list('reviews').filter((r) => r.kind === (mode === 'mois' ? 'month' : 'year')).sort((x, y) => (x.id < y.id ? 1 : -1));

  const trend = mode === 'annee'
    ? MONTHS.map((m, i) => { const f = ymd(new Date(year, i, 1, 12)); const s = rangeStats(store, f, endOfMonth(f), t).totals; return { label: m.slice(0, 3), value: Math.round(s.actualMin / 6) / 10 }; })
    : Array.from({ length: 6 }, (_, i) => { const f = startOfWeek(from) > from ? from : startOfWeek(from); const w = ymd(new Date(new Date(f).getTime() + i * 7 * 86400000)); if (w > to) return null; const s = rangeStats(store, w, ymd(new Date(new Date(w).getTime() + 6 * 86400000)), t).totals; return { label: `S${i + 1}`, value: Math.round(s.actualMin / 6) / 10 }; }).filter(Boolean);

  const save = () => {
    store.put('reviews', { id, kind: mode === 'mois' ? 'month' : 'year', period: mode === 'mois' ? month : String(year), note, savedAt: Date.now(), snapshot: { totals: a.st.totals, wins: a.wins, attention: a.attention, expense: a.fin.expense, income: a.fin.income, saving: a.fin.saving, books: a.books.length, goalsDone: a.goalsDone.length } });
    toast('Bilan enregistré.');
  };

  return (
    <div>
      <PageHead eyebrow={mode === 'mois' ? 'Bilan mensuel' : 'Bilan annuel'} title={<span style={{ textTransform: 'capitalize' }}>{mode === 'mois' ? fmtMonth(from) : year}</span>}>
        <Tabs tabs={[['mois', 'Mois'], ['annee', 'Année']]} value={mode} onChange={(m) => setParams(m === 'mois' ? { m: monthKey(t) } : { y: t.slice(0, 4) })} />
        <button className="btn icon" aria-label="Précédent" onClick={prev}><ChevronLeft size={18} /></button>
        <button className="btn icon" aria-label="Suivant" onClick={next}><ChevronRight size={18} /></button>
        <Link className="btn" to="/semaine/bilan">Bilan de la semaine</Link>
      </PageHead>

      <div className="grid g2 mb">
        <div className="card"><div className="card-head"><h3><Trophy size={18} />Réussites</h3></div>
          {a.wins.length ? <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>{a.wins.map((w, i) => <li key={i}>{w}</li>)}</ul> : <Empty>Pas encore de réussite enregistrée sur cette période. Elles apparaîtront dès que tu valides tes tâches, habitudes et objectifs.</Empty>}
        </div>
        <div className="card"><div className="card-head"><h3><Compass size={18} />Mérite plus d'attention</h3></div>
          {a.attention.length ? <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>{a.attention.map((w, i) => <li key={i}>{w}</li>)}</ul> : <Empty>Rien à signaler.</Empty>}
        </div>
      </div>

      <div className="card mb"><div className="card-head"><h3>En résumé</h3></div><ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>{a.summary.map((l, i) => <li key={i}>{l}</li>)}</ul></div>

      <div className="grid g4 mb">
        <div className="card stat"><span className="stat-label">Tâches validées</span><span className="stat-value">{a.st.totals.tasksDone}<span className="small muted"> / {a.st.totals.tasks}</span></span></div>
        <div className="card stat"><span className="stat-label">Heures effectuées</span><span className="stat-value">{fmtHours(a.st.totals.actualMin)}</span><span className="xs muted">prévues : {fmtHours(a.st.totals.plannedMin)}</span></div>
        <div className="card stat"><span className="stat-label">Habitudes</span><span className="stat-value">{a.habits.rate != null ? Math.round(a.habits.rate * 100) + ' %' : '—'}</span></div>
        <div className="card stat"><span className="stat-label">Objectifs atteints</span><span className="stat-value">{a.goalsDone.length}</span></div>
      </div>

      <div className="grid g2 mb">
        <div className="card"><div className="card-head"><h3>Progression universitaire</h3></div>
          <PlanActualChart groups={subjects.map((s) => ({ label: s.name.split(' ')[0], a: a.study[s.id].plannedMin / 60, b: a.study[s.id].actualMin / 60 }))} format={(v) => `${Math.round(v * 10) / 10}h`} />
          <div className="stack-sm mt">
            {subjects.map((s) => { const p = chapterProgress(s); const avg = gradeAverage(store.list('grades').filter((g) => g.subjectId === s.id && g.date >= from && g.date <= to)); return (
              <div key={s.id} className="row between small"><span>{s.name}</span><span className="muted">{p != null ? `chapitres ${Math.round(p * 100)} %` : 'aucun chapitre'} · {avg != null ? `${avg.toFixed(1)}/20` : 'pas de note'}</span></div>
            ); })}
          </div>
        </div>
        <div className="card"><div className="card-head"><h3>Heures effectuées dans le temps</h3></div>
          <Bars data={trend} format={(v) => `${v}h`} name="Heures effectuées" />
        </div>
      </div>

      <div className="grid g3 mb">
        <div className="card"><div className="card-head"><h3>Finances</h3></div>
          <div className="stack-sm small">
            <div className="row between"><span>Revenus</span><strong>{euro(a.fin.income)}</strong></div>
            <div className="row between"><span>Dépenses</span><strong>{euro(a.fin.expense)}</strong></div>
            {a.budget && <div className="row between"><span>Budget prévu</span><span>{euro(a.budget)}</span></div>}
            <div className="row between"><span>Épargne</span><strong>{euro(a.fin.saving)}</strong></div>
          </div>
          {finCats.length > 0 && <div className="mt"><HBars data={finCats.map(([l, v]) => ({ label: l, value: v }))} format={euro} /></div>}
        </div>
        <div className="card"><div className="card-head"><h3>Sport, lecture, langues</h3></div>
          <div className="stack-sm small">
            <div className="row between"><span>Séances de sport</span><strong>{a.sport.done}{a.sport.planned ? ` / ${a.sport.planned}` : ''}</strong></div>
            <div className="row between"><span>Temps d'activité physique</span><span>{fmtHours(a.sport.actualMin)}</span></div>
            <div className="row between"><span>Livres terminés</span><strong>{a.books.length}</strong></div>
            {a.books.map((b) => <div key={b.id} className="xs muted">· {b.title}</div>)}
            {languages.map((l) => <div key={l.id} className="row between"><span>{l.name}</span><span>{fmtHours(a.lang[l.id] || 0)}</span></div>)}
          </div>
        </div>
        <div className="card"><div className="card-head"><h3>Habitudes et projets</h3></div>
          <div className="stack-sm small">
            {a.habits.per.map((h) => <div key={h.habit.id}><div className="row between"><span>{h.habit.name}</span><span className="muted">{h.done}/{h.due}</span></div><Progress value={h.rate} color="var(--rose)" /></div>)}
            {!a.habits.per.length && <span className="muted">Aucune habitude suivie.</span>}
            <div className="row between mt"><span>Étapes de projets terminées</span><strong>{a.stepsDone.length}</strong></div>
            {a.stepsDone.slice(0, 6).map((s) => <div key={s.id} className="xs muted">· {s.project} : {s.title}</div>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Mes réflexions</h3></div>
        <textarea className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que je retiens, ce que je veux faire évoluer…" />
        <div className="row mt"><span className="xs muted" style={{ flex: 1 }}>{saved ? `Enregistré le ${new Date(saved.savedAt).toLocaleDateString('fr-FR')}` : 'Enregistrer conserve ce bilan dans ton historique.'}</span><button className="btn primary" onClick={save}><Save size={15} />Enregistrer le bilan</button></div>
        {savedList.length > 0 && (
          <details className="mt"><summary className="small" style={{ cursor: 'pointer' }}>Historique des bilans ({savedList.length})</summary>
            <div className="stack mt">{savedList.map((r) => (
              <div key={r.id} className="card flat" style={{ background: 'var(--surface-2)', cursor: 'pointer' }} onClick={() => setParams(r.kind === 'month' ? { m: r.period } : { y: r.period })}>
                <div className="row between"><strong>{r.period}</strong><span className="xs muted">{r.snapshot?.totals?.tasksDone} tâches · {fmtHours(r.snapshot?.totals?.actualMin)} · {r.snapshot?.goalsDone} objectifs</span></div>
                {r.note && <p className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.note}</p>}
              </div>
            ))}</div>
          </details>
        )}
      </div>
    </div>
  );
}

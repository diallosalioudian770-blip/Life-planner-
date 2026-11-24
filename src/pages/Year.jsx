import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BarChart3, Plus, Trash2, GraduationCap } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { rangeStats, studyStats, chapterProgress, gradeAverage } from '../lib/stats.js';
import { monthGrid, today, parse, MONTHS, fmtShort, fmtHours, addMonths, startOfMonth, ymd } from '../lib/date.js';
import { PageHead, Tabs, Empty, Progress, useCategories, useSettings, Field, toast } from '../components/ui.jsx';
import { GoalsBlock } from '../components/blocks.jsx';
import { TYPE } from '../lib/defaults.js';

function MiniMonth({ monthStart, marks, onClick }) {
  const g = monthGrid(monthStart);
  const t = today();
  const m = monthStart.slice(0, 7);
  return (
    <div className="mini-month" onClick={onClick} role="button" tabIndex={0} aria-label={MONTHS[parse(monthStart).getMonth()]}>
      <h4>{MONTHS[parse(monthStart).getMonth()]} <span className="xs muted">{monthStart.slice(0, 4)}</span></h4>
      <div className="mm-grid">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} className="mm-day xs muted">{d}</div>)}
        {g.map((d) => {
          const n = marks[d] || 0;
          const inM = d.slice(0, 7) === m;
          return <div key={d} className={'mm-day' + (inM && marks['!' + d] ? ' mark' : '') + (d === t ? ' today' : '')} style={{ color: inM ? undefined : 'transparent', background: inM && n ? `color-mix(in srgb, var(--rose) ${Math.min(80, n * 18)}%, transparent)` : undefined }}>{parse(d).getDate()}</div>;
        })}
      </div>
    </div>
  );
}

const bigTypes = ['examen', 'interro', 'echeance'];

function marksFor(occ) {
  const marks = {};
  for (const o of occ) {
    marks[o.date] = (marks[o.date] || 0) + 1;
    if (bigTypes.includes(o.type) || o.important) marks['!' + o.date] = true;
  }
  return marks;
}

function BigDates({ occ }) {
  const nav = useNavigate();
  const big = occ.filter((o) => bigTypes.includes(o.type) || o.important);
  return (
    <div className="card">
      <div className="card-head"><h3>Grandes échéances et événements importants</h3></div>
      {big.length ? (
        <div className="list">
          {big.map((o) => (
            <div key={o.key} className="list-row" style={{ cursor: 'pointer' }} onClick={() => nav('/jour?d=' + o.date)}>
              <span className="chip" style={{ minWidth: 70, justifyContent: 'center' }}>{fmtShort(o.date)}</span>
              <span style={{ flex: 1 }} className={o.status === 'done' ? 'done-text' : ''}>{o.title}</span>
              <span className="xs muted">{TYPE[o.type]?.label}</span>
            </div>
          ))}
        </div>
      ) : <Empty>Ajoute tes examens, échéances ou coche « Événement important » sur une activité pour la voir ici.</Empty>}
    </div>
  );
}

function AcademicYear() {
  const settings = useSettings();
  const years = settings.academicYears || [];
  const [selId, setSelId] = useState(years[years.length - 1]?.id);
  const [f, setF] = useState({ label: '', start: '', end: '' });
  const sel = years.find((y) => y.id === selId) || years[years.length - 1];
  useStore();
  const add = () => {
    if (!f.start || !f.end || f.end <= f.start) { toast('Indique une date de début et une date de fin valides.'); return; }
    const y = { id: uid('ay'), label: f.label || `${f.start.slice(0, 4)}–${f.end.slice(0, 4)}`, start: f.start, end: f.end };
    store.put('settings', { id: 'main', academicYears: [...years, y] });
    setSelId(y.id);
    setF({ label: '', start: '', end: '' });
  };
  const form = (
    <div className="card">
      <div className="card-head"><h3>Définir une année universitaire</h3></div>
      <div className="form-grid">
        <Field label="Nom (facultatif)"><input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ex. Bac 1" /></Field>
        <span />
        <Field label="Début"><input className="input" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} aria-label="Début de l'année universitaire" /></Field>
        <Field label="Fin"><input className="input" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} aria-label="Fin de l'année universitaire" /></Field>
      </div>
      <div className="row mt"><span style={{ flex: 1 }} /><button className="btn primary" onClick={add}><Plus size={15} />Ajouter</button></div>
    </div>
  );
  if (!sel) return <div className="stack"><Empty title="Aucune année universitaire">Tu choisis toi-même ses dates de début et de fin.</Empty>{form}</div>;
  const occ = occurrences(store, sel.start, sel.end);
  const marks = marksFor(occ);
  const months = [];
  for (let m = startOfMonth(sel.start); m <= sel.end; m = addMonths(m, 1)) months.push(m);
  const study = studyStats(store, sel.start, sel.end);
  const subjects = store.list('subjects');
  const grades = store.list('grades');
  return (
    <div className="stack">
      <div className="row wrap">
        {years.map((y) => <button key={y.id} className={'btn sm' + (y.id === sel.id ? ' primary' : '')} onClick={() => setSelId(y.id)}>{y.label}</button>)}
        <span className="small muted">{fmtShort(sel.start)} {sel.start.slice(0, 4)} → {fmtShort(sel.end)} {sel.end.slice(0, 4)}</span>
        <button className="btn ghost sm danger" onClick={() => { store.put('settings', { id: 'main', academicYears: years.filter((y) => y.id !== sel.id) }); setSelId(null); }}><Trash2 size={14} />Retirer</button>
      </div>
      <div className="year-grid">{months.map((m) => <MiniMonth key={m} monthStart={m} marks={marks} onClick={() => {}} />)}</div>
      <div className="grid g2">
        <BigDates occ={occ} />
        <div className="card">
          <div className="card-head"><h3><GraduationCap size={18} />Progression par matière</h3></div>
          <div className="stack-sm">
            {subjects.map((s) => {
              const p = chapterProgress(s);
              const avg = gradeAverage(grades.filter((g) => g.subjectId === s.id && g.date >= sel.start && g.date <= sel.end));
              return (
                <div key={s.id}>
                  <div className="row between small"><span>{s.name}</span><span className="muted">{fmtHours(study[s.id]?.actualMin)} · {avg != null ? `${avg.toFixed(1)}/20` : 'pas de note'}</span></div>
                  <Progress value={p || 0} color={s.color} label={`Chapitres ${s.name}`} />
                </div>
              );
            })}
          </div>
          <p className="xs muted mt">Barre : avancement des chapitres. Heures : travail personnel validé sur l'année universitaire.</p>
        </div>
      </div>
      {form}
    </div>
  );
}

export default function Year() {
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('y')) || parse(today()).getFullYear();
  const [tab, setTab] = useState('civile');
  const [yInput, setYInput] = useState(String(year));
  const nav = useNavigate();
  const cats = useCategories();
  useStore();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const occ = occurrences(store, from, to);
  const marks = marksFor(occ);
  const st = rangeStats(store, from, to, today());
  const projects = store.list('projects');
  const setYear = (y) => { setParams({ y: String(y) }); setYInput(String(y)); };

  // years that hold data, for the history list
  const yearsWithData = new Set([parse(today()).getFullYear()]);
  for (const it of store.list('items')) if (it.date) yearsWithData.add(Number(it.date.slice(0, 4)));
  for (const tx of store.list('transactions')) yearsWithData.add(Number(tx.date.slice(0, 4)));

  return (
    <div>
      <PageHead eyebrow="Année" title={tab === 'civile' ? String(year) : 'Année universitaire'}>
        <Tabs tabs={[['civile', 'Année civile'], ['univ', 'Année universitaire']]} value={tab} onChange={setTab} />
        {tab === 'civile' && <>
          <button className="btn icon" aria-label="Année précédente" onClick={() => setYear(year - 1)}><ChevronLeft size={18} /></button>
          <input className="input" style={{ width: 90 }} type="number" value={yInput} onChange={(e) => setYInput(e.target.value)} onBlur={() => Number(yInput) > 1900 && setYear(Number(yInput))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Année" />
          <button className="btn icon" aria-label="Année suivante" onClick={() => setYear(year + 1)}><ChevronRight size={18} /></button>
          <Link className="btn primary" to={`/bilan?y=${year}`}><BarChart3 size={16} />Bilan annuel</Link>
        </>}
      </PageHead>
      {tab === 'univ' ? <AcademicYear /> : (
        <div className="stack">
          <div className="year-grid" data-testid="year-grid">
            {MONTHS.map((_, i) => { const m = ymd(new Date(year, i, 1, 12)); return <MiniMonth key={m} monthStart={m} marks={marks} onClick={() => nav(`/mois?m=${m.slice(0, 7)}`)} />; })}
          </div>
          <div className="grid g2">
            <GoalsBlock horizon="annee" period={String(year)} title={`Objectifs ${year}`} defaults={{ refDate: from }} />
            <BigDates occ={occ} />
          </div>
          <div className="grid g2">
            <div className="card">
              <div className="card-head"><h3>Progression annuelle par catégorie</h3></div>
              {Object.keys(st.byCat).length ? (
                <div className="stack-sm">
                  {cats.filter((c) => st.byCat[c.id]).map((c) => {
                    const x = st.byCat[c.id];
                    return (
                      <div key={c.id}>
                        <div className="row between small"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: c.color }} />{c.name}</span><span className="muted">{x.tasksDone}/{x.tasks} · {fmtHours(x.actualMin)}</span></div>
                        <Progress value={x.tasks ? x.tasksDone / x.tasks : 0} color={c.color} />
                      </div>
                    );
                  })}
                </div>
              ) : <Empty>Aucune donnée pour {year}.</Empty>}
            </div>
            <div className="card">
              <div className="card-head"><h3>Projets à long terme</h3><Link className="small" to="/espace/projets">Tous les projets</Link></div>
              {projects.length ? (
                <div className="stack-sm">
                  {projects.map((p) => {
                    const steps = p.steps || [];
                    return (
                      <div key={p.id}>
                        <div className="row between small"><span>{p.name}</span><span className="muted">{steps.filter((s) => s.done).length}/{steps.length} étapes{p.deadline ? ' · ' + fmtShort(p.deadline) : ''}</span></div>
                        <Progress value={steps.length ? steps.filter((s) => s.done).length / steps.length : 0} color="var(--gold)" />
                      </div>
                    );
                  })}
                </div>
              ) : <Empty>Aucun projet.</Empty>}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Historique des années</h3></div>
            <div className="row wrap">
              {[...yearsWithData].sort().map((y) => {
                const s = rangeStats(store, `${y}-01-01`, `${y}-12-31`, today()).totals;
                return <button key={y} className={'btn' + (y === year ? ' primary' : '')} onClick={() => setYear(y)}>{y} · {s.tasksDone} tâches · {fmtHours(s.actualMin)}</button>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

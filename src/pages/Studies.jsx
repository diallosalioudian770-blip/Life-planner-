import { useState } from 'react';
import { Plus, Trash2, Wand2, ChevronLeft, ChevronRight, Copy, GraduationCap, AlertCircle, Timer } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { occurrences, createItem } from '../lib/recurrence.js';
import { studyStats, studyBalance, chapterProgress, gradeAverage } from '../lib/stats.js';
import { CHAPTER_STATUS, TYPE } from '../lib/defaults.js';
import { addDays, startOfWeek, today, fmtShort, fmtHours, weekDays, WEEKDAYS_SHORT, fmtDuration } from '../lib/date.js';
import { PageHead, Tabs, Progress, Empty, Field, Ring, useLocalState, toast, confirmDialog } from '../components/ui.jsx';
import { ItemRow, openItemForm, openTimeLog } from '../components/items.jsx';
import { CategoryAgenda, GoalsBlock } from '../components/blocks.jsx';
import { PlanActualChart } from '../components/charts.jsx';
import { SuggestionsModal } from './Suggestions.jsx';

const EXAM_TYPES = ['examen', 'interro', 'echeance'];
const COURSE_TYPES = ['cours', 'tp', 'remediation'];

function Dashboard() {
  useStore();
  const t = today();
  const from = startOfWeek(t);
  const subjects = store.list('subjects').sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const st = studyStats(store, from, addDays(from, 6));
  const bal = studyBalance(store, t);
  const progs = subjects.map(chapterProgress).filter((p) => p != null);
  const global = progs.length ? progs.reduce((a, b) => a + b, 0) / progs.length : null;
  const notions = subjects.flatMap((s) => (s.notions || []).filter((n) => !n.done).map((n) => ({ ...n, subject: s })));
  const totalGoal = subjects.reduce((a, s) => a + (s.weeklyGoalMin || 0), 0);
  const totalActual = Object.values(st).reduce((a, x) => a + x.actualMin, 0);
  return (
    <div className="stack">
      <div className="grid g4">
        <div className="card row" style={{ gap: 14 }}><Ring value={global || 0}>{global == null ? '—' : undefined}</Ring><div className="stat"><span className="stat-label">Progression globale</span><span className="xs muted">{global == null ? 'Ajoute des chapitres à tes matières' : 'moyenne des chapitres'}</span></div></div>
        <div className="card stat"><span className="stat-label">Révisions cette semaine</span><span className="stat-value">{fmtHours(totalActual)}</span><span className="xs muted">{totalGoal ? `objectif : ${fmtHours(totalGoal)}` : "pas d'objectif défini"}</span></div>
        <div className="card stat"><span className="stat-label">Notions à revoir</span><span className="stat-value">{notions.length}</span></div>
        <div className="card stat"><span className="stat-label">Échéances à 14 jours</span><span className="stat-value">{occurrences(store, t, addDays(t, 14)).filter((o) => EXAM_TYPES.includes(o.type) && o.status !== 'done').length}</span></div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="card-head"><h3>Cette semaine, par matière</h3><button className="btn sm" onClick={() => openTimeLog({ categoryId: 'etudes' })}><Timer size={14} />Noter du temps</button></div>
          <div className="stack-sm">
            {subjects.map((s) => {
              const x = st[s.id];
              const goal = s.weeklyGoalMin || x.plannedMin;
              return (
                <div key={s.id}>
                  <div className="row between small"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: s.color }} />{s.name}{s.reinforced && <span className="chip xs">à renforcer</span>}</span><span className="muted">{fmtHours(x.actualMin)}{goal ? ` / ${fmtHours(goal)}` : ''}</span></div>
                  <Progress value={goal ? x.actualMin / goal : 0} color={s.color} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Équilibre sur 4 semaines</h3></div>
          {bal.some((b) => b.goalMin) ? (
            <div className="stack-sm">
              {bal.filter((b) => b.goalMin).map((b) => (
                <div key={b.subject.id} className="row between small">
                  <span>{b.subject.name}</span>
                  <span className={'chip' + (b.verdict === 'moins' ? ' prio-haute' : b.verdict === 'plus' ? ' gold' : '')}>{b.verdict === 'moins' ? 'moins que prévu' : b.verdict === 'plus' ? 'plus que prévu' : 'équilibré'} · {Math.round(b.ratio * 100)} %</span>
                </div>
              ))}
              <p className="xs muted mt">Comparaison entre ton temps réellement validé et tes objectifs hebdomadaires.</p>
            </div>
          ) : <Empty>Fixe un objectif hebdomadaire par matière (onglet Matières) pour voir où tu passes trop ou trop peu de temps.</Empty>}
        </div>
      </div>
      <div className="grid g2">
        <CategoryAgenda categoryId="etudes" types={EXAM_TYPES} title="Examens et travaux à venir" days={60} addLabel="Échéance" defaults={{ type: 'examen', priority: 'fixe' }} />
        <div className="card">
          <div className="card-head"><h3><AlertCircle size={18} />Notions à revoir</h3></div>
          {notions.length ? <div className="list">{notions.map((n) => <div key={n.id} className="list-row small"><i className="dot" style={{ background: n.subject.color }} /><span style={{ flex: 1 }}>{n.text}</span><span className="xs muted">{n.subject.name}</span></div>)}</div> : <Empty>Ajoute les notions à revoir dans chaque matière.</Empty>}
        </div>
      </div>
    </div>
  );
}

function Timetable() {
  const [ref, setRef] = useState(today());
  const from = startOfWeek(ref);
  const days = weekDays(from);
  useStore();
  const occ = occurrences(store, from, addDays(from, 6)).filter((o) => o.categoryId === 'etudes' && (COURSE_TYPES.includes(o.type) || EXAM_TYPES.includes(o.type)));
  const subjects = store.list('subjects');
  const [f, setF] = useState({ type: 'cours', subjectId: subjects[0]?.id || '', date: today(), start: '', durationMin: 120, location: '', repeat: false, until: '' });
  const add = (e) => {
    e.preventDefault();
    if (!f.subjectId || !f.date || !f.start) { toast('Indique la matière, la date et l\'heure.'); return; }
    const s = subjects.find((x) => x.id === f.subjectId);
    createItem(store, {
      title: `${TYPE[f.type].label} — ${s.name}`, type: f.type, categoryId: 'etudes', subjectId: f.subjectId, date: f.date, start: f.start, durationMin: Number(f.durationMin) || 60,
      location: f.location, priority: 'fixe', recur: f.repeat ? { freq: 'weekly', interval: 1, days: [new Date(f.date + 'T12:00').getDay()], until: f.until || null } : null,
    });
    toast('Cours ajouté.');
  };
  const copyPrev = async () => {
    const prev = occurrences(store, addDays(from, -7), addDays(from, -1)).filter((o) => o.categoryId === 'etudes' && COURSE_TYPES.includes(o.type) && !o.recurring);
    if (!prev.length) { toast('Aucun cours ponctuel la semaine précédente.'); return; }
    if (!(await confirmDialog({ title: 'Copier la semaine précédente', message: `Copier ${prev.length} cours de la semaine précédente vers cette semaine ? Tu pourras ensuite ajuster chaque horaire.`, confirm: 'Copier' }))) return;
    for (const o of prev) createItem(store, { ...o.item, id: undefined, date: addDays(o.date, 7), status: 'todo', actualMin: null, doneAt: null, postponed: [] });
    toast('Cours copiés.');
  };
  return (
    <div className="stack">
      <div className="banner info">Tes horaires changent selon les semaines : rien n'est pré-rempli. Ajoute tes cours ici chaque semaine (ou en répétition si un cours revient), puis ajuste-les depuis le calendrier.</div>
      <div className="row wrap">
        <button className="btn icon" aria-label="Semaine précédente" onClick={() => setRef(addDays(from, -7))}><ChevronLeft size={18} /></button>
        <strong>Semaine du {fmtShort(from)}</strong>
        <button className="btn icon" aria-label="Semaine suivante" onClick={() => setRef(addDays(from, 7))}><ChevronRight size={18} /></button>
        <button className="btn sm" onClick={copyPrev}><Copy size={14} />Copier la semaine précédente</button>
      </div>
      <div className="grid cols-2-1">
        <div className="grid g-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {days.map((d, i) => (
            <div key={d} className="card" style={{ padding: 12 }}>
              <div className="row between"><strong className="small">{WEEKDAYS_SHORT[i]} {fmtShort(d)}</strong><button className="btn ghost icon sm" aria-label="Ajouter un cours" onClick={() => setF({ ...f, date: d })}><Plus size={14} /></button></div>
              {occ.filter((o) => o.date === d).map((o) => <ItemRow key={o.key} o={o} compact showCat={false} />)}
              {!occ.some((o) => o.date === d) && <p className="xs muted">—</p>}
            </div>
          ))}
        </div>
        <form className="card" onSubmit={add}>
          <div className="card-head"><h3>Ajouter un cours</h3></div>
          <div className="form-grid">
            <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{[...COURSE_TYPES, 'travail', 'interro', 'examen', 'echeance'].map((t) => <option key={t} value={t}>{TYPE[t].label}</option>)}</select></Field>
            <Field label="Matière"><select className="input" value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Heure"><input className="input" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} aria-label="Heure du cours" /></Field>
            <Field label="Durée (min)"><input className="input" type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></Field>
            <Field label="Lieu / auditoire"><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <label className="row small full"><input type="checkbox" checked={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.checked })} />Se répète chaque semaine</label>
            {f.repeat && <Field label="Jusqu'au" full><input className="input" type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></Field>}
          </div>
          <button className="btn primary mt" style={{ width: '100%' }}><Plus size={15} />Ajouter</button>
        </form>
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder, withStatus, withDone }) {
  const [text, setText] = useState('');
  return (
    <div>
      <form className="row mb" style={{ marginBottom: 8 }} onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onChange([...items, { id: uid(), text: text.trim(), status: 'a_faire', done: false }]); setText(''); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button className="btn icon primary" aria-label="Ajouter"><Plus size={16} /></button>
      </form>
      <div className="list">
        {items.map((it) => (
          <div key={it.id} className="list-row">
            {withDone && <input type="checkbox" checked={!!it.done} onChange={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done, doneDate: !x.done ? today() : null } : x)))} aria-label={it.text} />}
            <input className="input" style={{ border: 0, background: 'transparent', padding: 0, minHeight: 30 }} defaultValue={it.text} onBlur={(e) => e.target.value !== it.text && onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))} aria-label="Intitulé" />
            {withStatus && (
              <select className="input" style={{ width: 130 }} value={it.status} onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, status: e.target.value } : x)))} aria-label="Statut du chapitre">
                {CHAPTER_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            <button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => onChange(items.filter((x) => x.id !== it.id))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectDetail({ s, onBack }) {
  useStore();
  const upd = (p) => store.put('subjects', { id: s.id, ...p });
  const grades = store.list('grades').filter((g) => g.subjectId === s.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const avg = gradeAverage(grades);
  const st = studyStats(store, '2000-01-01', today())[s.id];
  const p = chapterProgress(s);
  const t = today();
  const counts = Object.fromEntries(CHAPTER_STATUS.map((c) => [c.id, (s.chapters || []).filter((x) => x.status === c.id).length]));
  return (
    <div className="stack">
      <div className="row wrap"><button className="btn sm" onClick={onBack}><ChevronLeft size={14} />Toutes les matières</button><h2 style={{ flex: 1 }}>{s.name}</h2>
        <button className="btn sm danger" onClick={async () => { if (await confirmDialog({ title: 'Supprimer la matière', message: `Supprimer « ${s.name} » ? Les activités déjà planifiées restent dans ton calendrier.`, confirm: 'Supprimer' })) { store.remove('subjects', s.id); onBack(); } }}><Trash2 size={14} />Supprimer</button>
      </div>
      <div className="grid g4">
        <div className="card row" style={{ gap: 12 }}><Ring value={p || 0} size={60}>{p == null ? '—' : undefined}</Ring><div className="small">{CHAPTER_STATUS.map((c) => <div key={c.id}>{c.label} : {counts[c.id]}</div>)}</div></div>
        <div className="card stat"><span className="stat-label">Temps de travail validé (total)</span><span className="stat-value">{fmtHours(st?.actualMin)}</span></div>
        <div className="card stat"><span className="stat-label">Moyenne</span><span className="stat-value">{avg == null ? '—' : `${avg.toFixed(1)}/20`}</span></div>
        <div className="card stat"><span className="stat-label">Prochaine échéance</span><span className="small">{(() => { const n = occurrences(store, t, addDays(t, 120)).find((o) => o.subjectId === s.id && EXAM_TYPES.includes(o.type)); return n ? `${fmtShort(n.date)} · ${n.title}` : 'Aucune'; })()}</span></div>
      </div>
      <div className="card">
        <div className="form-grid">
          <Field label="Nom"><input className="input" defaultValue={s.name} onBlur={(e) => upd({ name: e.target.value })} /></Field>
          <Field label="Objectif hebdomadaire de révision (minutes)"><input className="input" type="number" step="15" defaultValue={s.weeklyGoalMin ?? ''} onBlur={(e) => upd({ weeklyGoalMin: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Objectif hebdomadaire en minutes" /></Field>
          <Field label="Couleur"><input type="color" className="color-input" value={s.color} onChange={(e) => upd({ color: e.target.value })} /></Field>
          <label className="row small" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!s.reinforced} onChange={(e) => upd({ reinforced: e.target.checked })} />Matière à renforcer (priorité dans les propositions)</label>
          <Field label="Mon objectif pour cette matière" full><input className="input" defaultValue={s.objective || ''} onBlur={(e) => upd({ objective: e.target.value })} placeholder="Ex. Comprendre l'amortissement et réussir l'interro" /></Field>
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Chapitres</h3></div><EditableList items={s.chapters || []} onChange={(chapters) => upd({ chapters })} placeholder="Nouveau chapitre" withStatus /></div>
        <div className="stack">
          <div className="card"><div className="card-head"><h3>Exercices à faire</h3></div><EditableList items={s.exercises || []} onChange={(exercises) => upd({ exercises })} placeholder="Ex. Série 3, ex. 1 à 5" withDone /></div>
          <div className="card"><div className="card-head"><h3>Notions à revoir</h3></div><EditableList items={s.notions || []} onChange={(notions) => upd({ notions })} placeholder="Notion à revoir" withDone /></div>
        </div>
      </div>
      <div className="grid g2">
        <CategoryAgenda categoryId="etudes" filter={(o) => o.subjectId === s.id} title="Séances, cours et échéances" days={30} defaults={{ subjectId: s.id, type: 'revision', priority: 'haute', title: `Révision — ${s.name}` }} />
        <div className="card"><div className="card-head"><h3>Notes</h3></div><GradesTable subjectId={s.id} /></div>
      </div>
      <div className="card"><div className="card-head"><h3>Notes de cours</h3></div><textarea className="input" rows={6} defaultValue={s.notes || ''} onBlur={(e) => upd({ notes: e.target.value })} /></div>
    </div>
  );
}

function Subjects() {
  const subjects = useStore((s) => s.list('subjects')).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const [sel, setSel] = useLocalState('study-subject', null);
  const [name, setName] = useState('');
  const t = today();
  const st = studyStats(store, startOfWeek(t), addDays(startOfWeek(t), 6));
  const grades = store.list('grades');
  const current = subjects.find((s) => s.id === sel);
  if (current) return <SubjectDetail s={current} onBack={() => setSel(null)} />;
  return (
    <div className="stack">
      <div className="grid g-auto">
        {subjects.map((s) => {
          const p = chapterProgress(s);
          const avg = gradeAverage(grades.filter((g) => g.subjectId === s.id));
          return (
            <button key={s.id} className="card space-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setSel(s.id)}>
              <div className="row"><i className="dot" style={{ background: s.color, width: 12, height: 12 }} /><strong style={{ flex: 1 }}>{s.name}</strong></div>
              <div className="xs muted">{(s.chapters || []).length} chapitre(s) · {fmtHours(st[s.id]?.actualMin)} cette semaine{s.weeklyGoalMin ? ` / ${fmtHours(s.weeklyGoalMin)}` : ''} · {avg == null ? 'pas de note' : `${avg.toFixed(1)}/20`}</div>
              <Progress value={p || 0} color={s.color} />
              {s.reinforced && <span className="chip xs" style={{ alignSelf: 'flex-start' }}>à renforcer</span>}
            </button>
          );
        })}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; store.put('subjects', { name: name.trim(), color: '#5B6B8C', rank: subjects.length, chapters: [], exercises: [], notions: [], weeklyGoalMin: null }); setName(''); }}>
        <input className="input" style={{ maxWidth: 340 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle matière" aria-label="Nouvelle matière" />
        <button className="btn primary"><Plus size={15} />Ajouter une matière</button>
      </form>
    </div>
  );
}

export function GradesTable({ subjectId }) {
  const subjects = useStore((s) => s.list('subjects'));
  const grades = useStore((s) => s.list('grades')).filter((g) => !subjectId || g.subjectId === subjectId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const [f, setF] = useState({ subjectId: subjectId || subjects[0]?.id, label: '', score: '', max: 20, coef: 1, date: today() });
  const add = (e) => {
    e.preventDefault();
    if (f.score === '' || !f.max) { toast('Indique la note et le maximum.'); return; }
    store.put('grades', { ...f, score: Number(f.score), max: Number(f.max), coef: Number(f.coef) || 1 });
    setF({ ...f, label: '', score: '' });
  };
  return (
    <div>
      <form className="row wrap mb" onSubmit={add} style={{ gap: 6 }}>
        {!subjectId && <select className="input" style={{ width: 200 }} value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value })} aria-label="Matière">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <input className="input" style={{ flex: '1 1 140px' }} placeholder="Évaluation" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} aria-label="Évaluation" />
        <input className="input" style={{ width: 70 }} type="number" step="0.5" placeholder="Note" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} aria-label="Note" />
        <span className="small">/</span>
        <input className="input" style={{ width: 64 }} type="number" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} aria-label="Sur" />
        <input className="input" style={{ width: 64 }} type="number" step="0.5" value={f.coef} onChange={(e) => setF({ ...f, coef: e.target.value })} aria-label="Coefficient" title="Coefficient" />
        <input className="input" style={{ width: 150 }} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Date de la note" />
        <button className="btn primary icon" aria-label="Ajouter la note"><Plus size={16} /></button>
      </form>
      {grades.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr>{!subjectId && <th>Matière</th>}<th>Évaluation</th><th>Note</th><th>/20</th><th>Coef.</th><th>Date</th><th /></tr></thead>
          <tbody>{grades.map((g) => (
            <tr key={g.id}>{!subjectId && <td>{subjects.find((s) => s.id === g.subjectId)?.name}</td>}<td>{g.label || '—'}</td><td>{g.score}/{g.max}</td><td><strong>{((g.score / g.max) * 20).toFixed(1)}</strong></td><td>{g.coef}</td><td>{fmtShort(g.date)}</td>
              <td><button className="btn ghost icon sm" aria-label="Supprimer la note" onClick={() => store.remove('grades', g.id)}><Trash2 size={14} /></button></td></tr>
          ))}</tbody>
        </table></div>
      ) : <Empty>Aucune note enregistrée.</Empty>}
    </div>
  );
}

function Grades() {
  const subjects = useStore((s) => s.list('subjects'));
  const grades = store.list('grades');
  const all = gradeAverage(grades);
  return (
    <div className="stack">
      <div className="grid g-auto">
        <div className="card stat"><span className="stat-label">Moyenne générale (pondérée)</span><span className="stat-value">{all == null ? '—' : `${all.toFixed(2)}/20`}</span></div>
        {subjects.map((s) => { const a = gradeAverage(grades.filter((g) => g.subjectId === s.id)); return a == null ? null : <div key={s.id} className="card stat"><span className="stat-label">{s.name}</span><span className="stat-value" style={{ fontSize: '1.5rem' }}>{a.toFixed(1)}/20</span></div>; })}
      </div>
      <div className="card"><GradesTable /></div>
    </div>
  );
}

function Revisions() {
  const [sugg, setSugg] = useState(false);
  const [ref, setRef] = useState(today());
  useStore();
  const from = startOfWeek(ref);
  const subjects = store.list('subjects');
  const sessions = occurrences(store, from, addDays(from, 6)).filter((o) => o.categoryId === 'etudes' && TYPE[o.type]?.study);
  const weeks = Array.from({ length: 4 }, (_, i) => addDays(from, -7 * (3 - i)));
  const per = weeks.map((w) => studyStats(store, w, addDays(w, 6)));
  return (
    <div className="stack">
      <div className="row wrap">
        <button className="btn icon" aria-label="Semaine précédente" onClick={() => setRef(addDays(from, -7))}><ChevronLeft size={18} /></button>
        <strong>Semaine du {fmtShort(from)}</strong>
        <button className="btn icon" aria-label="Semaine suivante" onClick={() => setRef(addDays(from, 7))}><ChevronRight size={18} /></button>
        <button className="btn primary" onClick={() => setSugg(true)}><Wand2 size={16} />Proposer un planning de révision</button>
        <button className="btn" onClick={() => openItemForm({ defaults: { categoryId: 'etudes', type: 'revision', priority: 'haute', date: from > today() ? from : today(), durationMin: 60 } })}><Plus size={15} />Séance</button>
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Séances de la semaine</h3><span className="xs muted">{fmtDuration(sessions.reduce((a, o) => a + o.durationMin, 0))} prévues</span></div>
          {sessions.length ? <div className="list">{sessions.map((o) => <ItemRow key={o.key} o={o} showDate showCat={false} />)}</div> : <Empty>Aucune séance de révision planifiée cette semaine.</Empty>}
        </div>
        <div className="card"><div className="card-head"><h3>Objectifs hebdomadaires (minutes)</h3></div>
          <div className="stack-sm">{subjects.map((s) => (
            <div key={s.id} className="row between small"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: s.color }} />{s.name}</span>
              <input className="input" type="number" step="15" style={{ width: 100 }} defaultValue={s.weeklyGoalMin ?? ''} placeholder="—" onBlur={(e) => store.put('subjects', { id: s.id, weeklyGoalMin: e.target.value === '' ? null : Number(e.target.value) })} aria-label={`Objectif ${s.name}`} /></div>
          ))}</div>
        </div>
      </div>
      <div className="card"><div className="card-head"><h3>Prévu et réalisé, 4 dernières semaines</h3></div>
        <PlanActualChart groups={weeks.map((w, i) => ({ label: fmtShort(w), a: Object.values(per[i]).reduce((a, x) => a + x.plannedMin, 0) / 60, b: Object.values(per[i]).reduce((a, x) => a + x.actualMin, 0) / 60 }))} format={(v) => `${Math.round(v * 10) / 10}h`} />
      </div>
      {sugg && <SuggestionsModal weekDate={from} onClose={() => setSugg(false)} />}
    </div>
  );
}

export default function Studies({ cat }) {
  const [tab, setTab] = useLocalState('study-tab', 'dash');
  return (
    <div>
      <PageHead eyebrow="Priorité 1" title={<span className="row"><GraduationCap size={28} style={{ color: cat.color }} />{cat.name}</span>} sub="UCLouvain FUCaM Mons · Sciences de gestion, 1re année" />
      <div className="mb"><Tabs tabs={[['dash', 'Tableau de bord'], ['edt', 'Emploi du temps'], ['matieres', 'Matières'], ['revisions', 'Révisions'], ['examens', 'Examens & travaux'], ['notes', 'Notes'], ['objectifs', 'Objectifs']]} value={tab} onChange={setTab} /></div>
      {tab === 'dash' && <Dashboard />}
      {tab === 'edt' && <Timetable />}
      {tab === 'matieres' && <Subjects />}
      {tab === 'revisions' && <Revisions />}
      {tab === 'examens' && <div className="grid g2"><CategoryAgenda categoryId="etudes" types={EXAM_TYPES} title="À venir" days={365} addLabel="Ajouter" defaults={{ type: 'examen', priority: 'fixe' }} /><CategoryAgenda categoryId="etudes" types={['travail', 'exercices']} title="Travaux universitaires" days={120} defaults={{ type: 'travail', priority: 'haute' }} /></div>}
      {tab === 'notes' && <Grades />}
      {tab === 'objectifs' && <GoalsBlock categoryId="etudes" title="Objectifs universitaires" defaults={{ horizon: 'semaine' }} />}
    </div>
  );
}

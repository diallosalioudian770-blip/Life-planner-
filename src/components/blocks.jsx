import { useState } from 'react';
import { Plus, Pencil, Trash2, Target, X } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { rangeStats, goalProgress, goalValue } from '../lib/stats.js';
import { addDays, today, weekKey, monthKey, startOfWeek, startOfMonth, endOfMonth, fmtHours, fmtShort } from '../lib/date.js';
import { Modal, Field, Progress, Empty, Check2, closeDialog, openDialog, confirmDialog, toast, useCategories, useCat } from './ui.jsx';
import { ItemRow, openItemForm } from './items.jsx';

export function CategoryAgenda({ categoryId, types, title = 'À venir', days = 30, defaults = {}, filter, emptyText, addLabel = 'Ajouter' }) {
  useStore();
  const t = today();
  const pass = (o) => (categoryId ? o.categoryId === categoryId : true) && (!types || types.includes(o.type)) && (!filter || filter(o));
  const overdue = occurrences(store, addDays(t, -60), addDays(t, -1)).filter((o) => pass(o) && o.isTask && o.status !== 'done');
  const upcoming = occurrences(store, t, addDays(t, days)).filter(pass);
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <button className="btn sm" onClick={() => openItemForm({ defaults: { categoryId, type: types?.[0] || 'tache', ...defaults } })}><Plus size={14} />{addLabel}</button>
      </div>
      {overdue.length > 0 && (
        <>
          <div className="xs muted" style={{ textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 2 }}>En attente (jours passés)</div>
          <div className="list mb">{overdue.map((o) => <ItemRow key={o.key} o={o} showDate showCat={!categoryId} />)}</div>
        </>
      )}
      {upcoming.length ? <div className="list">{upcoming.slice(0, 40).map((o) => <ItemRow key={o.key} o={o} showDate showCat={!categoryId} />)}</div>
        : <Empty title="Rien de prévu">{emptyText || `Aucune activité dans les ${days} prochains jours.`}</Empty>}
    </div>
  );
}

export function CategoryStats({ categoryId }) {
  useStore();
  const t = today();
  const w = rangeStats(store, startOfWeek(t), addDays(startOfWeek(t), 6), t).byCat[categoryId];
  const m = rangeStats(store, startOfMonth(t), endOfMonth(t), t).byCat[categoryId];
  const Box = ({ label, s }) => (
    <div className="card flat" style={{ background: 'var(--surface-2)', padding: 14 }}>
      <div className="xs muted" style={{ textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
      {s ? (
        <div className="stack-sm" style={{ marginTop: 6 }}>
          <div className="row between small"><span>Tâches validées</span><strong>{s.tasksDone} / {s.tasks}</strong></div>
          <Progress value={s.tasks ? s.tasksDone / s.tasks : 0} />
          <div className="row between small"><span>Temps prévu</span><span>{fmtHours(s.plannedMin)}</span></div>
          <div className="row between small"><span>Temps réellement effectué</span><strong>{fmtHours(s.actualMin)}</strong></div>
        </div>
      ) : <p className="small muted" style={{ marginTop: 6 }}>Aucune donnée pour l'instant.</p>}
    </div>
  );
  return (
    <div className="card">
      <div className="card-head"><h3>Statistiques</h3></div>
      <div className="grid g2"><Box label="Cette semaine" s={w} /><Box label="Ce mois-ci" s={m} /></div>
    </div>
  );
}

export const HORIZONS = [['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['annee', 'Cette année'], ['long', 'Long terme']];
export const periodFor = (h, d = today()) => (h === 'semaine' ? weekKey(d) : h === 'mois' ? monthKey(d) : h === 'annee' ? d.slice(0, 4) : null);
const METRICS = [['manuel', 'Je mets à jour moi-même'], ['heures', 'Heures réellement effectuées dans la catégorie'], ['taches', 'Tâches validées dans la catégorie'], ['seances', 'Séances de sport validées'], ['livres', 'Livres terminés'], ['epargne', 'Montant épargné (€)']];

export const openGoalForm = (goal, defaults) => openDialog({ type: 'goal', goal, defaults });

export function GoalForm({ d }) {
  const cats = useCategories();
  const [f, setF] = useState(d.goal || { title: '', categoryId: 'glowup', horizon: 'mois', metric: 'manuel', target: '', unit: '', current: 0, notes: '', steps: [], ...(d.defaults || {}) });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!f.title.trim()) { toast('Donne un nom à ton objectif.'); return; }
    const period = f.period && d.goal?.horizon === f.horizon ? f.period : periodFor(f.horizon, f.refDate || today());
    store.put('goals', { ...f, title: f.title.trim(), period, target: f.target === '' ? null : Number(f.target), createdAt: f.createdAt || Date.now() });
    closeDialog();
    toast('Objectif enregistré.');
  };
  return (
    <Modal title={d.goal ? "Modifier l'objectif" : 'Nouvel objectif'} onClose={closeDialog} footer={<>
      {d.goal && <button className="btn ghost danger" onClick={async () => { if (await confirmDialog({ title: 'Supprimer', message: 'Supprimer cet objectif ?', confirm: 'Supprimer' })) { store.remove('goals', d.goal.id); } }}><Trash2 size={15} />Supprimer</button>}
      <span style={{ flex: 1 }} />
      <button className="btn ghost" onClick={closeDialog}>Annuler</button><button className="btn primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Objectif" full><input className="input" autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Formule-le avec tes mots" aria-label="Objectif" /></Field>
        <Field label="Catégorie"><select className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Horizon"><select className="input" value={f.horizon} onChange={(e) => set('horizon', e.target.value)}>{HORIZONS.map(([id, l]) => <option key={id} value={id}>{l.replace('Cette ', '').replace('Ce ', '')}</option>)}</select></Field>
        <Field label="Mesure" full><select className="input" value={f.metric} onChange={(e) => set('metric', e.target.value)}>{METRICS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
        <Field label="Cible (facultatif)"><input className="input" type="number" value={f.target ?? ''} onChange={(e) => set('target', e.target.value)} /></Field>
        <Field label="Unité"><input className="input" value={f.unit || ''} onChange={(e) => set('unit', e.target.value)} placeholder="h, séances, pages…" /></Field>
        {f.metric === 'manuel' && f.target !== '' && f.target != null && <Field label="Valeur actuelle"><input className="input" type="number" value={f.current ?? 0} onChange={(e) => set('current', Number(e.target.value))} /></Field>}
        <div className="full">
          <div className="row between"><span className="small" style={{ fontWeight: 500 }}>Étapes (facultatif)</span>
            <button type="button" className="btn sm" onClick={() => set('steps', [...(f.steps || []), { id: uid(), text: '', done: false }])}><Plus size={14} />Étape</button></div>
          {(f.steps || []).map((s, i) => (
            <div key={s.id} className="row" style={{ marginTop: 6 }}>
              <input className="input" value={s.text} placeholder={`Étape ${i + 1}`} onChange={(e) => set('steps', f.steps.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))} />
              <button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => set('steps', f.steps.filter((x) => x.id !== s.id))}><X size={14} /></button>
            </div>
          ))}
        </div>
        <Field label="Notes" full><textarea className="input" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function GoalItem({ g }) {
  const cat = useCat()(g.categoryId);
  useStore();
  const t = today();
  const p = goalProgress(store, g, t);
  const v = goalValue(store, g, t);
  const toggle = () => store.put('goals', { id: g.id, done: !g.done, doneAt: g.done ? null : Date.now(), doneDate: g.done ? null : t });
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <Check2 on={g.done} onClick={toggle} label={`Objectif « ${g.title} » atteint`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={'row between' + (g.done ? ' done-text' : '')} style={{ gap: 8 }}>
          <span style={{ fontWeight: 500 }}>{g.title}</span>
          <button className="btn ghost icon sm" aria-label={`Modifier l'objectif ${g.title}`} onClick={() => openGoalForm(g)}><Pencil size={14} /></button>
        </div>
        <div className="row xs muted" style={{ gap: 8 }}>
          <span className="row" style={{ gap: 4 }}><i className="dot" style={{ background: cat.color, width: 7, height: 7 }} />{cat.name}</span>
          {g.target ? <span>{Math.round(v * 10) / 10} / {g.target} {g.unit}</span> : null}
          {g.steps?.length ? <span>{g.steps.filter((s) => s.done).length}/{g.steps.length} étapes</span> : null}
        </div>
        {(g.target || g.steps?.length) ? <div style={{ marginTop: 6 }}><Progress value={p} color={cat.color} /></div> : null}
        {g.steps?.length > 0 && (
          <div className="stack-sm" style={{ marginTop: 6 }}>
            {g.steps.map((s) => (
              <label key={s.id} className="row small" style={{ gap: 8 }}>
                <input type="checkbox" checked={!!s.done} onChange={() => store.put('goals', { id: g.id, steps: g.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done, doneDate: !x.done ? today() : null } : x)) })} />
                <span className={s.done ? 'done-text' : ''}>{s.text}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GoalsBlock({ categoryId, horizon, period, title = 'Objectifs', defaults = {} }) {
  const goals = useStore((s) => s.list('goals'))
    .filter((g) => (!categoryId || g.categoryId === categoryId) && (!horizon || g.horizon === horizon) && (!period || g.period === period || g.horizon === 'long'))
    .sort((a, b) => (a.done - b.done) || (a.createdAt || 0) - (b.createdAt || 0));
  return (
    <div className="card">
      <div className="card-head">
        <h3><Target size={18} />{title}</h3>
        <button className="btn sm" onClick={() => openGoalForm(null, { categoryId: categoryId || 'glowup', horizon: horizon || 'mois', ...defaults })}><Plus size={14} />Objectif</button>
      </div>
      {goals.length ? <div className="list">{goals.map((g) => <GoalItem key={g.id} g={g} />)}</div> : <Empty title="Aucun objectif">Crée tes propres objectifs, tu peux les modifier à tout moment.</Empty>}
    </div>
  );
}

// Simple editable checklists (courses, idées, démarches, sujets à découvrir…)
export function ListBlock({ space, title, placeholder = 'Ajouter…', withDate, icon, hint }) {
  const rows = useStore((s) => s.list('lists')).filter((r) => r.space === space).sort((a, b) => (a.done - b.done) || (a.createdAt || 0) - (b.createdAt || 0));
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(null);
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    store.put('lists', { space, text: text.trim(), date: date || null, done: false, createdAt: Date.now() });
    setText(''); setDate('');
  };
  return (
    <div className="card">
      <div className="card-head"><h3>{icon}{title}</h3>{rows.some((r) => r.done) && <button className="btn ghost sm" onClick={() => rows.filter((r) => r.done).forEach((r) => store.remove('lists', r.id))}>Effacer les terminés</button>}</div>
      {hint && <p className="small muted mb">{hint}</p>}
      <form className="row mb" onSubmit={add}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={title} />
        {withDate && <input className="input" style={{ width: 150 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Échéance" />}
        <button className="btn primary icon" aria-label="Ajouter"><Plus size={18} /></button>
      </form>
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="list-row">
            <Check2 on={r.done} onClick={() => store.put('lists', { id: r.id, done: !r.done, doneDate: !r.done ? today() : null })} label={r.text} />
            {editing === r.id
              ? <input className="input" autoFocus defaultValue={r.text} onBlur={(e) => { store.put('lists', { id: r.id, text: e.target.value }); setEditing(null); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
              : <span className={'grow' + (r.done ? ' done-text' : '')} style={{ flex: 1 }} onDoubleClick={() => setEditing(r.id)}>{r.text}</span>}
            {r.date && <span className={'chip' + (r.date < today() && !r.done ? ' prio-haute' : '')}>{fmtShort(r.date)}</span>}
            <button className="btn ghost icon sm" aria-label="Modifier" onClick={() => setEditing(r.id)}><Pencil size={14} /></button>
            <button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('lists', r.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotesBlock({ title, value, onChange, placeholder, rows = 6 }) {
  const [v, setV] = useState(value || '');
  return (
    <div className="card">
      <div className="card-head"><h3>{title}</h3></div>
      <textarea className="input" rows={rows} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value || '') && onChange(v)} />
      <p className="xs muted" style={{ marginTop: 4 }}>Enregistré automatiquement quand tu quittes le champ.</p>
    </div>
  );
}

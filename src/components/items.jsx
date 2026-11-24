import { useState } from 'react';
import { Pencil, Trash2, CalendarClock, Repeat, Clock, MapPin, Plus, X, Star } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { ITEM_TYPES, PRIORITIES, TYPE, LANGUAGE_SKILLS } from '../lib/defaults.js';
import { createItem, updateOccurrence, deleteOccurrence, setStatus, moveOccurrence, setOccFields } from '../lib/recurrence.js';
import { addDays, fmtDuration, fmtShort, startOfWeek, today, parse, WEEKDAYS_LONG, toMin, fromMin } from '../lib/date.js';
import { Modal, Field, Check2, closeDialog, openDialog, scopeDialog, confirmDialog, toast, useCategories, useCat } from './ui.jsx';

export const openItemForm = (opts = {}) => openDialog({ type: 'item', ...opts });
export const openTimeLog = (defaults = {}) => openDialog({ type: 'timelog', defaults });
export const openPostpone = (o) => openDialog({ type: 'postpone', occ: o });

export async function toggleDone(o) {
  if (o.status === 'done') { setStatus(store, o, 'todo'); return; }
  if (o.durationMin > 0 || o.type === 'seance' || TYPE[o.type]?.study) openDialog({ type: 'check', occ: o });
  else { setStatus(store, o, 'done'); toast('Bravo, tâche validée.'); }
}

export async function deleteWithScope(o) {
  if (o.recurring) {
    const scope = await scopeDialog('supprimer');
    if (!scope) return;
    deleteOccurrence(store, o, scope);
  } else {
    const ok = await confirmDialog({ title: 'Supprimer', message: `Supprimer « ${o.title} » ?`, confirm: 'Supprimer' });
    if (!ok) return;
    deleteOccurrence(store, o);
  }
  toast('Supprimé.');
}

// Drag & drop / quick move, asks the scope for recurring activities.
export async function moveWithScope(o, date, start = o.start) {
  if (o.date === date && o.start === start) return;
  if (o.recurring) {
    const scope = await scopeDialog('déplacer');
    if (!scope) return;
  }
  moveOccurrence(store, o, date, start, { postpone: date > o.date && o.status !== 'done' && o.isTask });
  toast(`Déplacé au ${fmtShort(date)}${start ? ' à ' + start : ''}.`);
}

export function ItemRow({ o, showDate, showCat = true, compact }) {
  const cat = useCat()(o.categoryId);
  const subj = useStore((s) => (o.subjectId ? s.get('subjects', o.subjectId) : null));
  const done = o.status === 'done';
  const overdue = !done && o.isTask && o.date < today();
  const prio = PRIORITIES.find((p) => p.id === o.priority);
  return (
    <div className="list-row" data-testid="item-row" draggable={!compact} onDragStart={(e) => { e.dataTransfer.setData('text/occ', o.key); window.__dragOcc = o; }}>
      <Check2 on={done} onClick={() => toggleDone(o)} label={done ? `Marquer « ${o.title} » comme non terminée` : `Valider « ${o.title} »`} />
      <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: cat.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openItemForm({ occ: o })}>
        <div className={'ellipsis' + (done ? ' done-text' : '')} style={{ fontWeight: 500 }}>
          {o.important && <Star size={13} style={{ color: 'var(--gold)', marginRight: 4, verticalAlign: -1 }} fill="currentColor" />}
          {o.title}
        </div>
        <div className="row wrap xs muted" style={{ gap: 8, marginTop: 1 }}>
          {showDate && <span className={overdue ? '' : ''} style={overdue ? { color: 'var(--danger)' } : null}>{fmtShort(o.date)}</span>}
          {o.start && <span className="row" style={{ gap: 3 }}><Clock size={11} />{o.start}{o.durationMin ? ` · ${fmtDuration(o.durationMin)}` : ''}</span>}
          {!o.start && o.durationMin > 0 && <span>{fmtDuration(o.durationMin)}</span>}
          {TYPE[o.type] && o.type !== 'tache' && <span>{TYPE[o.type].label}</span>}
          {subj && <span>{subj.name}</span>}
          {showCat && !subj && <span>{cat.name}</span>}
          {o.location && <span className="row" style={{ gap: 3 }}><MapPin size={11} />{o.location}</span>}
          {o.recurring && <Repeat size={11} aria-label="Récurrente" />}
          {o.postponed?.length > 0 && <span>reportée {o.postponed.length}×</span>}
          {done && o.actualMin != null && <span style={{ color: 'var(--ok)' }}>réalisé : {fmtDuration(o.actualMin)}</span>}
        </div>
      </div>
      {(o.priority === 'fixe' || o.priority === 'haute') && <span className={'chip prio-' + o.priority}>{prio?.short}</span>}
      {!compact && (
        <div className="row" style={{ gap: 0 }}>
          {!done && <button className="btn ghost icon sm" title="Reporter" aria-label={`Reporter « ${o.title} »`} onClick={() => openPostpone(o)}><CalendarClock size={16} /></button>}
          <button className="btn ghost icon sm" title="Modifier" aria-label={`Modifier « ${o.title} »`} onClick={() => openItemForm({ occ: o })}><Pencil size={15} /></button>
          <button className="btn ghost icon sm" title="Supprimer" aria-label={`Supprimer « ${o.title} »`} onClick={() => deleteWithScope(o)}><Trash2 size={15} /></button>
        </div>
      )}
    </div>
  );
}

const REMINDERS = [[null, 'Aucun rappel'], [0, "À l'heure"], [10, '10 min avant'], [30, '30 min avant'], [60, '1 h avant'], [180, '3 h avant'], [1440, '1 jour avant'], [4320, '3 jours avant']];

export function ItemForm({ d }) {
  const cats = useCategories();
  const subjects = useStore((s) => s.list('subjects'));
  const projects = useStore((s) => s.list('projects'));
  const languages = useStore((s) => s.list('languages'));
  const o = d.occ;
  const init = o
    ? { ...o.item, ...(o.recurring ? { title: o.title, start: o.start, durationMin: o.durationMin, notes: o.notes, priority: o.priority, location: o.location, categoryId: o.categoryId, subjectId: o.subjectId, type: o.type, important: o.important, exercises: o.exercises } : {}), date: o.date }
    : { title: '', type: 'tache', categoryId: 'perso', priority: 'secondaire', date: today(), start: '', durationMin: 0, notes: '', recur: null, reminderMin: null, ...(d.defaults || {}) };
  const [f, setF] = useState(init);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const recur = f.recur;
  const setRecur = (p) => set('recur', p === null ? null : { interval: 1, ...(recur || {}), ...p });

  async function save() {
    if (!f.title?.trim()) { toast('Donne un nom à cette activité.'); return; }
    const data = {
      title: f.title.trim(), type: f.type, categoryId: f.categoryId, priority: f.priority, date: f.date || null,
      start: f.start || null, durationMin: Number(f.durationMin) || 0, notes: f.notes || '', location: f.location || '',
      subjectId: f.subjectId || null, projectId: f.projectId || null, languageId: f.languageId || null, skill: f.skill || null,
      important: !!f.important, reminderMin: f.reminderMin ?? null, exercises: f.exercises || null,
    };
    if (data.recur === undefined && recur?.freq === 'weekly' && !recur.days?.length) recur.days = [parse(data.date).getDay()];
    if (!o) {
      createItem(store, { ...data, recur: recur?.freq ? recur : null });
      toast('Ajouté au planning.');
    } else if (!o.recurring) {
      updateOccurrence(store, o, { ...data, recur: recur?.freq ? recur : null });
      toast('Modifications enregistrées.');
    } else {
      const scope = await scopeDialog('modifier');
      if (!scope) return;
      if (scope !== 'this') data.recur = recur?.freq ? recur : null;
      if (scope === 'this' && data.date === o.date) delete data.date;
      if (scope !== 'this' && !data.recur) {
        // repetition removed: the series stops and this occurrence becomes a one-off
        if (scope === 'all' || o.origDate <= o.item.date) store.put('items', { id: o.itemId, ...data, date: data.date || o.date, recur: null });
        else {
          deleteOccurrence(store, o, 'future');
          createItem(store, { ...data, date: data.date || o.date, recur: null });
        }
      } else updateOccurrence(store, o, data, scope);
      toast('Modifications enregistrées.');
    }
    closeDialog();
  }

  const isStudyCat = f.categoryId === 'etudes';
  const exercises = f.exercises || [];
  return (
    <Modal title={o ? 'Modifier' : 'Ajouter au planning'} onClose={closeDialog} footer={<>
      {o && <button className="btn danger ghost" onClick={() => { closeDialog(); deleteWithScope(o); }}><Trash2 size={15} />Supprimer</button>}
      <span className="grow" style={{ flex: 1 }} />
      <button className="btn ghost" onClick={closeDialog}>Annuler</button>
      <button className="btn primary" onClick={save}>Enregistrer</button>
    </>}>
      <div className="form-grid">
        <Field label="Nom" full><input className="input" autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Réviser le chapitre 2" aria-label="Nom" /></Field>
        <Field label="Type">
          <select className="input" aria-label="Type" value={f.type} onChange={(e) => {
            const t = e.target.value;
            setF((x) => ({ ...x, type: t, categoryId: TYPE[t]?.course || TYPE[t]?.study || TYPE[t]?.exam ? 'etudes' : t === 'seance' ? 'sport' : t === 'langue' ? 'langues' : t === 'lecture' ? 'lecture' : t === 'sortie' || t === 'invitation' ? 'social' : x.categoryId, priority: TYPE[t]?.course || TYPE[t]?.exam ? 'fixe' : x.priority }));
          }}>
            {ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Catégorie">
          <select className="input" aria-label="Catégorie" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {(isStudyCat || f.subjectId) && (
          <Field label="Matière">
            <select className="input" aria-label="Matière" value={f.subjectId || ''} onChange={(e) => set('subjectId', e.target.value)}>
              <option value="">—</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        {(f.categoryId === 'langues' || f.languageId) && (<>
          <Field label="Langue">
            <select className="input" aria-label="Langue" value={f.languageId || ''} onChange={(e) => set('languageId', e.target.value)}>
              <option value="">—</option>
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Compétence">
            <select className="input" aria-label="Compétence" value={f.skill || ''} onChange={(e) => set('skill', e.target.value)}>
              <option value="">—</option>
              {LANGUAGE_SKILLS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </Field>
        </>)}
        {(f.categoryId === 'projets' || f.projectId) && (
          <Field label="Projet">
            <select className="input" aria-label="Projet" value={f.projectId || ''} onChange={(e) => set('projectId', e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Date"><input className="input" type="date" value={f.date || ''} onChange={(e) => set('date', e.target.value)} aria-label="Date" /></Field>
        <Field label="Heure (facultatif)"><input className="input" type="time" value={f.start || ''} onChange={(e) => set('start', e.target.value)} aria-label="Heure" /></Field>
        <Field label="Durée prévue (minutes)"><input className="input" type="number" min="0" step="5" inputMode="numeric" value={f.durationMin || ''} onChange={(e) => set('durationMin', e.target.value)} aria-label="Durée" /></Field>
        <Field label="Priorité">
          <select className="input" aria-label="Priorité" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Répétition">
          <select className="input" value={recur?.freq || ''} aria-label="Répétition" onChange={(e) => setRecur(e.target.value ? { freq: e.target.value, days: e.target.value === 'weekly' ? (recur?.days?.length ? recur.days : [parse(f.date || today()).getDay()]) : undefined } : null)}>
            <option value="">Ne se répète pas</option>
            <option value="daily">Tous les jours</option>
            <option value="weekly">Chaque semaine</option>
            <option value="monthly">Chaque mois</option>
          </select>
        </Field>
        <Field label="Rappel">
          <select className="input" aria-label="Rappel" value={f.reminderMin ?? ''} onChange={(e) => set('reminderMin', e.target.value === '' ? null : Number(e.target.value))}>
            {REMINDERS.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
          </select>
        </Field>
        {recur?.freq && (
          <div className="full card flat" style={{ padding: 12, background: 'var(--surface-2)' }}>
            <div className="row wrap">
              <span className="small">Toutes les</span>
              <input className="input" style={{ width: 70 }} type="number" min="1" value={recur.interval || 1} onChange={(e) => setRecur({ interval: Number(e.target.value) || 1 })} aria-label="Intervalle" />
              <span className="small">{recur.freq === 'daily' ? 'jour(s)' : recur.freq === 'weekly' ? 'semaine(s)' : 'mois'}</span>
              <span className="small" style={{ marginLeft: 12 }}>jusqu'au</span>
              <input className="input" style={{ width: 160 }} type="date" value={recur.until || ''} onChange={(e) => setRecur({ until: e.target.value || null })} aria-label="Fin de la répétition" />
            </div>
            {recur.freq === 'weekly' && (
              <div className="row wrap mt" style={{ gap: 6, marginTop: 10 }}>
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const on = (recur.days || []).includes(wd);
                  return <button key={wd} type="button" className={'btn sm' + (on ? ' primary' : '')} onClick={() => setRecur({ days: on ? recur.days.filter((x) => x !== wd) : [...(recur.days || []), wd] })}>{WEEKDAYS_LONG[wd].slice(0, 3)}</button>;
                })}
              </div>
            )}
          </div>
        )}
        <Field label="Lieu (facultatif)"><input className="input" value={f.location || ''} onChange={(e) => set('location', e.target.value)} /></Field>
        <label className="row small" style={{ alignSelf: 'end', minHeight: 40 }}><input type="checkbox" checked={!!f.important} onChange={(e) => set('important', e.target.checked)} /> Événement important (visible dans l'année)</label>
        {f.type === 'seance' && (
          <div className="full">
            <div className="row between"><span className="small" style={{ fontWeight: 500 }}>Exercices</span>
              <button type="button" className="btn sm" onClick={() => set('exercises', [...exercises, { name: '', sets: '', reps: '', weight: '', minutes: '' }])}><Plus size={14} />Exercice</button></div>
            {exercises.map((ex, i) => (
              <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
                <input className="input" placeholder="Exercice" value={ex.name} onChange={(e) => set('exercises', exercises.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input" style={{ width: 64 }} placeholder="Séries" value={ex.sets} onChange={(e) => set('exercises', exercises.map((x, j) => (j === i ? { ...x, sets: e.target.value } : x)))} />
                <input className="input" style={{ width: 64 }} placeholder="Rép." value={ex.reps} onChange={(e) => set('exercises', exercises.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
                <input className="input" style={{ width: 70 }} placeholder="kg" value={ex.weight} onChange={(e) => set('exercises', exercises.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => set('exercises', exercises.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <Field label="Notes" full><textarea className="input" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function CheckDialog({ d }) {
  const o = d.occ;
  const [min, setMin] = useState(o.durationMin || '');
  const [results, setResults] = useState(o.results || (o.exercises || []).map((e) => ({ ...e })));
  const finish = (withTime) => {
    setStatus(store, o, 'done', withTime && min !== '' ? Number(min) : null);
    if (o.type === 'seance' && results.length) setOccFields(store, { ...o }, { results });
    closeDialog();
    toast('Bravo, c\'est validé.');
  };
  return (
    <Modal title="Valider l'activité" onClose={closeDialog} footer={<>
      <button className="btn ghost" onClick={() => finish(false)}>Valider sans temps</button>
      <button className="btn primary" onClick={() => finish(true)}>Valider</button>
    </>}>
      <p className="mb"><strong>{o.title}</strong></p>
      <Field label="Temps réellement effectué (minutes)" hint={o.durationMin ? `Prévu : ${fmtDuration(o.durationMin)}. Indique le temps réel, même s'il est différent.` : null}>
        <input className="input" type="number" min="0" step="5" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} autoFocus aria-label="Temps réellement effectué" />
      </Field>
      {o.type === 'seance' && results.length > 0 && (
        <div className="mt">
          <div className="small" style={{ fontWeight: 500 }}>Ce que tu as réellement fait</div>
          {results.map((ex, i) => (
            <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
              <span className="small ellipsis" style={{ flex: 1 }}>{ex.name}</span>
              {['sets', 'reps', 'weight'].map((k) => (
                <input key={k} className="input" style={{ width: 64 }} placeholder={k === 'sets' ? 'Séries' : k === 'reps' ? 'Rép.' : 'kg'} value={ex[k] ?? ''} onChange={(e) => setResults(results.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function PostponeDialog({ d }) {
  const o = d.occ;
  const [date, setDate] = useState(addDays(o.date < today() ? today() : o.date, 1));
  const [start, setStart] = useState(o.start || '');
  const go = (dt, st = start) => {
    moveOccurrence(store, o, dt, st || null, { postpone: true });
    closeDialog();
    toast(`Reporté au ${fmtShort(dt)}.`);
  };
  const base = o.date < today() ? today() : o.date;
  const nextMonday = addDays(startOfWeek(base), 7);
  return (
    <Modal title="Reporter" onClose={closeDialog}>
      <p className="muted mb">« {o.title} » ne disparaîtra pas : choisis quand la refaire.</p>
      <div className="row wrap mb">
        {o.date < today() && <button className="btn" onClick={() => go(today())}>Aujourd'hui</button>}
        <button className="btn" onClick={() => go(addDays(base, 1))}>Le lendemain</button>
        <button className="btn" onClick={() => go(addDays(base, 2))}>Dans 2 jours</button>
        <button className="btn" onClick={() => go(nextMonday)}>Lundi prochain</button>
      </div>
      <div className="form-grid">
        <Field label="Autre date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Heure"><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <div className="row mt"><span className="grow" style={{ flex: 1 }} /><button className="btn primary" onClick={() => go(date)}>Reporter à cette date</button></div>
    </Modal>
  );
}

export function TimeLogDialog({ d }) {
  const cats = useCategories();
  const subjects = useStore((s) => s.list('subjects'));
  const languages = useStore((s) => s.list('languages'));
  const [f, setF] = useState({ date: today(), minutes: '', categoryId: 'etudes', subjectId: '', languageId: '', skill: '', note: '', ...d.defaults });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!Number(f.minutes)) { toast('Indique une durée.'); return; }
    store.put('logs', { ...f, minutes: Number(f.minutes), createdAt: Date.now() });
    closeDialog();
    toast('Temps enregistré.');
  };
  return (
    <Modal title="Noter du temps réellement effectué" onClose={closeDialog} footer={<><button className="btn ghost" onClick={closeDialog}>Annuler</button><button className="btn primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Durée (minutes)"><input className="input" type="number" min="1" inputMode="numeric" value={f.minutes} onChange={(e) => set('minutes', e.target.value)} autoFocus aria-label="Durée en minutes" /></Field>
        <Field label="Catégorie">
          <select className="input" aria-label="Catégorie" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        {f.categoryId === 'etudes' && (
          <Field label="Matière"><select className="input" aria-label="Matière" value={f.subjectId} onChange={(e) => set('subjectId', e.target.value)}><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        )}
        {f.categoryId === 'langues' && (<>
          <Field label="Langue"><select className="input" aria-label="Langue" value={f.languageId} onChange={(e) => set('languageId', e.target.value)}><option value="">—</option>{languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label="Compétence"><select className="input" aria-label="Compétence" value={f.skill} onChange={(e) => set('skill', e.target.value)}><option value="">—</option>{LANGUAGE_SKILLS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
        </>)}
        <Field label="Note" full><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export const minutesBetween = (a, b) => toMin(b) - toMin(a);
export { fromMin };

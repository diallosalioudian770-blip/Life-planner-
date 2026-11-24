import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Heart, Droplets, Utensils, Dumbbell, Users, Flower2, Home as HomeIcon, Sparkles, Play } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { habitDone } from '../lib/stats.js';
import { ROUTINE_KINDS } from '../lib/defaults.js';
import { today, addDays, startOfWeek, weekDays, WEEKDAYS_SHORT, WEEKDAYS_LONG, fmtShort, fmtDay, fmtDuration, rangeDays, startOfMonth, endOfMonth } from '../lib/date.js';
import { PageHead, Tabs, Field, Empty, Progress, Modal, useSettings, toast, useLocalState, confirmDialog } from '../components/ui.jsx';
import { CategoryAgenda, GoalsBlock, ListBlock, CategoryStats } from '../components/blocks.jsx';
import { openItemForm, openTimeLog } from '../components/items.jsx';
import { Line, Bars } from '../components/charts.jsx';
import { HabitToggle, RoutineCard, routineDue } from './HabitsWidgets.jsx';

const Title = ({ cat, Icon, eyebrow }) => <PageHead eyebrow={eyebrow} title={<span className="row"><Icon size={26} style={{ color: cat.color }} />{cat.name}</span>} />;

// ---------------- Glow up ----------------
function Journal() {
  useStore();
  const [date, setDate] = useState(today());
  const id = 'j:' + date;
  const e = store.get('journal', id) || {};
  const upd = (p) => store.put('journal', { id, date, ...e, ...p });
  const entries = store.list('journal').sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="grid cols-2-1">
      <div className="card" key={id}>
        <div className="card-head"><h3>Journal</h3><input className="input" type="date" style={{ width: 160 }} value={date} onChange={(ev) => setDate(ev.target.value || today())} aria-label="Date du journal" /></div>
        <div className="stack">
          <Field label="Humeur du jour" group>
            <div className="row wrap">{['Difficile', 'Mitigée', 'Correcte', 'Bonne', 'Lumineuse'].map((m, i) => <button key={m} type="button" className={'btn sm' + (e.mood === i + 1 ? ' primary' : '')} onClick={() => upd({ mood: i + 1 })}>{m}</button>)}</div>
          </Field>
          <Field label={`Confiance en moi aujourd'hui : ${e.confidence ?? '—'}/10`}><input type="range" min="1" max="10" value={e.confidence || 5} onChange={(ev) => upd({ confidence: Number(ev.target.value) })} aria-label="Confiance en soi" /></Field>
          <Field label="Ce dont je suis reconnaissante"><textarea className="input" rows={2} defaultValue={e.gratitude || ''} onBlur={(ev) => upd({ gratitude: ev.target.value })} /></Field>
          <Field label="Mes petites victoires (estime de soi)"><textarea className="input" rows={2} defaultValue={e.wins || ''} onBlur={(ev) => upd({ wins: ev.target.value })} /></Field>
          <Field label="Écriture libre"><textarea className="input" rows={7} defaultValue={e.text || ''} onBlur={(ev) => upd({ text: ev.target.value })} placeholder="Ce que je ressens, ce que j'ai appris aujourd'hui…" /></Field>
          <p className="xs muted">Enregistré automatiquement.</p>
        </div>
      </div>
      <div className="stack">
        <div className="card"><div className="card-head"><h3>Confiance, 30 derniers jours</h3></div>
          <Line data={rangeDays(addDays(today(), -29), today()).map((d) => ({ label: fmtShort(d), value: store.get('journal', 'j:' + d)?.confidence ?? null }))} format={(v) => Math.round(v)} name="Confiance en soi" />
        </div>
        <div className="card"><div className="card-head"><h3>Entrées</h3></div>
          {entries.length ? <div className="list">{entries.slice(0, 30).map((x) => (
            <button key={x.id} className="list-row" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setDate(x.date)}>
              <span className="small" style={{ flex: 1, textTransform: 'capitalize' }}>{fmtDay(x.date)}</span>
              {x.confidence && <span className="chip">{x.confidence}/10</span>}
            </button>
          ))}</div> : <Empty>Aucune entrée pour l'instant.</Empty>}
        </div>
      </div>
    </div>
  );
}

function Affirmations() {
  const settings = useSettings();
  const list = settings.affirmations || [];
  const [text, setText] = useState('');
  const save = (affirmations) => store.put('settings', { id: 'main', affirmations });
  return (
    <div className="card">
      <div className="card-head"><h3><Heart size={18} />Mes affirmations</h3></div>
      <p className="small muted mb">Une affirmation s'affiche chaque jour sur l'accueil. Écris-les avec tes propres mots.</p>
      <form className="row mb" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { save([...list, text.trim()]); setText(''); } }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Je suis…" aria-label="Nouvelle affirmation" />
        <button className="btn primary icon" aria-label="Ajouter"><Plus size={16} /></button>
      </form>
      <div className="list">{list.map((a, i) => (
        <div key={i} className="list-row"><span className="serif italic" style={{ flex: 1, fontSize: '1.12rem' }}>{a}</span><button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => save(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>
      ))}</div>
    </div>
  );
}

const SLOTS = [['petitdej', 'Petit-déjeuner'], ['dejeuner', 'Déjeuner'], ['diner', 'Dîner'], ['collation', 'Collation']];
function Meals() {
  const [ref, setRef] = useState(today());
  useStore();
  const days = weekDays(ref);
  const get = (d, s) => store.get('meals', `${d}:${s}`);
  return (
    <div className="stack">
      <div className="row"><button className="btn sm" onClick={() => setRef(addDays(ref, -7))}>‹ Semaine précédente</button><strong className="small">Semaine du {fmtShort(days[0])}</strong><button className="btn sm" onClick={() => setRef(addDays(ref, 7))}>Semaine suivante ›</button></div>
      <p className="small muted">Organise tes repas et note ce que tu as mangé si tu le souhaites. Aucun objectif alimentaire n'est imposé : fixe les tiens dans l'onglet Objectifs.</p>
      <div className="table-wrap card" style={{ padding: 8 }}>
        <table className="table" style={{ minWidth: 760 }}>
          <thead><tr><th /> {days.map((d, i) => <th key={d}>{WEEKDAYS_SHORT[i]} {fmtShort(d)}</th>)}</tr></thead>
          <tbody>{SLOTS.map(([s, l]) => (
            <tr key={s}><td className="small" style={{ fontWeight: 600 }}>{l}</td>
              {days.map((d) => { const m = get(d, s); return (
                <td key={d} style={{ verticalAlign: 'top' }}>
                  <textarea className="input" rows={2} style={{ minHeight: 54, fontSize: 13 }} defaultValue={m?.text || ''} key={`${d}:${s}:${m?.updatedAt || 0}`} onBlur={(e) => e.target.value !== (m?.text || '') && store.put('meals', { id: `${d}:${s}`, date: d, slot: s, text: e.target.value })} aria-label={`${l} ${d}`} />
                  {m?.text && <label className="xs row" style={{ gap: 4 }}><input type="checkbox" checked={!!m.eaten} onChange={() => store.put('meals', { id: m.id, eaten: !m.eaten })} />mangé</label>}
                </td>
              ); })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ListBlock space="recettes" title="Idées de repas et recettes" placeholder="Ex. Bowl saumon avocat" />
    </div>
  );
}

function Hydration() {
  useStore();
  const h = store.list('habits').find((x) => x.tag === 'hydratation' && !x.archived);
  const [target, setTarget] = useState('');
  const t = today();
  if (!h) return (
    <div className="card">
      <div className="card-head"><h3><Droplets size={18} />Hydratation</h3></div>
      <p className="small muted mb">Choisis toi-même ton objectif quotidien (en verres) pour commencer le suivi.</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (!Number(target)) return; store.put('habits', { name: 'Hydratation', tag: 'hydratation', kind: 'build', unit: 'verres', target: Number(target), schedule: { type: 'daily' }, categoryId: 'glowup', createdDate: t }); }}>
        <input className="input" style={{ width: 120 }} type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Verres / jour" aria-label="Objectif de verres par jour" />
        <button className="btn primary">Commencer le suivi</button>
      </form>
    </div>
  );
  const days = rangeDays(addDays(t, -13), t);
  return (
    <div className="card">
      <div className="card-head"><h3><Droplets size={18} />Hydratation</h3><span className="row small">Objectif : <input className="input" style={{ width: 70 }} type="number" defaultValue={h.target} onBlur={(e) => Number(e.target.value) && store.put('habits', { id: h.id, target: Number(e.target.value) })} aria-label="Objectif hydratation" /> verres</span></div>
      <div className="row between mb"><span>Aujourd'hui</span><HabitToggle h={h} date={t} /></div>
      <Bars data={days.map((d) => ({ label: fmtShort(d).split(' ')[0], value: Number(store.get('habitLogs', `${h.id}@${d}`)?.value) || 0 }))} name="Verres par jour" format={(v) => Math.round(v)} />
      <p className="xs muted">{days.filter((d) => habitDone(h, store.get('habitLogs', `${h.id}@${d}`))).length} jour(s) sur 14 avec l'objectif atteint.</p>
    </div>
  );
}

export function GlowUp({ cat }) {
  const [tab, setTab] = useLocalState('glow-tab', 'objectifs');
  return (
    <div>
      <Title cat={cat} Icon={Sparkles} eyebrow="Priorité 2" />
      <div className="mb"><Tabs tabs={[['objectifs', 'Objectifs'], ['journal', 'Journal & confiance'], ['affirmations', 'Affirmations'], ['repas', 'Repas & alimentation'], ['hydratation', 'Hydratation'], ['planning', 'Planning & stats']]} value={tab} onChange={setTab} /></div>
      {tab === 'objectifs' && <div className="grid g2"><GoalsBlock categoryId="glowup" title="Mes objectifs Glow up" defaults={{ horizon: 'mois' }} /><GoalsBlock categoryId="glowup" horizon="long" title="Ma vision à long terme" defaults={{ horizon: 'long' }} /></div>}
      {tab === 'journal' && <Journal />}
      {tab === 'affirmations' && <Affirmations />}
      {tab === 'repas' && <Meals />}
      {tab === 'hydratation' && <Hydration />}
      {tab === 'planning' && <div className="grid g2"><CategoryAgenda categoryId="glowup" title="Activités Glow up" /><CategoryStats categoryId="glowup" /></div>}
    </div>
  );
}

// ---------------- Social ----------------
export function Social({ cat }) {
  useStore();
  const t = today();
  const month = occurrences(store, startOfMonth(t), endOfMonth(t)).filter((o) => o.categoryId === 'social');
  return (
    <div>
      <Title cat={cat} Icon={Users} eyebrow="Priorité 3" />
      <div className="banner info mb">Ici, on suit des envies et des efforts, pas des scores. Chaque sortie, message ou nouvelle expérience compte, à ton rythme.</div>
      <div className="grid g3 mb">
        <div className="card stat"><span className="stat-label">Moments sociaux ce mois</span><span className="stat-value">{month.filter((o) => o.status === 'done').length}</span><span className="xs muted">vécus et validés</span></div>
        <div className="card stat"><span className="stat-label">Prévus ce mois</span><span className="stat-value">{month.filter((o) => o.status !== 'done' && o.date >= t).length}</span></div>
        <div className="card stat"><span className="stat-label">Nouvelles expériences vécues</span><span className="stat-value">{store.list('lists').filter((l) => l.space === 'social-experiences' && l.done).length}</span></div>
      </div>
      <div className="grid g2">
        <CategoryAgenda categoryId="social" types={['sortie', 'evenement', 'invitation', 'rdv', 'tache']} title="Sorties, événements et invitations" days={60} defaults={{ type: 'sortie' }} />
        <GoalsBlock categoryId="social" title="Mes objectifs de sociabilité" />
        <ListBlock space="social-experiences" title="Nouvelles expériences à tenter" placeholder="Ex. Rejoindre un cercle étudiant" />
        <ListBlock space="social-proches" title="Projets avec mes proches" placeholder="Ex. Organiser un pique-nique" withDate />
        <ListBlock space="social-rencontres" title="Rencontres et personnes à recontacter" placeholder="Ex. Recontacter une amie du lycée" />
      </div>
    </div>
  );
}

// ---------------- Personnel ----------------
export function Personal({ cat }) {
  return (
    <div>
      <Title cat={cat} Icon={HomeIcon} />
      <div className="grid g2">
        <CategoryAgenda categoryId="perso" types={['rdv', 'evenement', 'sortie']} title="Rendez-vous et événements" days={60} defaults={{ type: 'rdv' }} />
        <CategoryAgenda categoryId="perso" types={['tache', 'demarche', 'menage']} title="Tâches et obligations" days={30} defaults={{ type: 'tache' }} />
        <ListBlock space="demarches" title="Démarches administratives" placeholder="Ex. Renouveler ma carte d'identité" withDate />
        <ListBlock space="courses" title="Liste de courses" placeholder="Ex. Lait d'avoine" />
        <CategoryAgenda categoryId="perso" types={['menage']} title="Tâches ménagères" days={14} defaults={{ type: 'menage', recur: { freq: 'weekly', interval: 1 } }} emptyText="Ajoute une tâche ménagère récurrente (ex. chaque samedi)." />
        <GoalsBlock categoryId="perso" title="Objectifs personnels" />
        <CategoryStats categoryId="perso" />
      </div>
    </div>
  );
}

// ---------------- Sport ----------------
function WorkoutTemplates() {
  const tpl = useStore((s) => s.list('workoutTemplates'));
  const [edit, setEdit] = useState(null);
  return (
    <div className="card">
      <div className="card-head"><h3>Mes séances types</h3><button className="btn sm" onClick={() => setEdit({ name: '', durationMin: 45, exercises: [] })}><Plus size={14} />Séance type</button></div>
      {tpl.length ? <div className="list">{tpl.map((t) => (
        <div key={t.id} className="list-row">
          <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{t.name}</div><div className="xs muted">{fmtDuration(t.durationMin)} · {(t.exercises || []).map((e) => e.name).filter(Boolean).join(', ') || 'aucun exercice'}</div></div>
          <button className="btn sm primary" onClick={() => openItemForm({ defaults: { title: t.name, type: 'seance', categoryId: 'sport', durationMin: t.durationMin, exercises: t.exercises, date: today() } })}><Play size={13} />Planifier</button>
          <button className="btn ghost icon sm" aria-label="Modifier" onClick={() => setEdit(t)}><Pencil size={14} /></button>
          <button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('workoutTemplates', t.id)}><Trash2 size={14} /></button>
        </div>
      ))}</div> : <Empty>Crée des séances types (ex. « Renforcement 30 min ») puis planifie-les selon tes disponibilités, en ajustant leur durée.</Empty>}
      {edit && (
        <Modal title="Séance type" onClose={() => setEdit(null)} footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary" onClick={() => { if (!edit.name.trim()) return toast('Nomme la séance.'); store.put('workoutTemplates', edit); setEdit(null); }}>Enregistrer</button></>}>
          <div className="form-grid">
            <Field label="Nom"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Durée (min)"><input className="input" type="number" value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: Number(e.target.value) })} /></Field>
            <div className="full">
              <button type="button" className="btn sm mb" onClick={() => setEdit({ ...edit, exercises: [...edit.exercises, { name: '', sets: '', reps: '', weight: '' }] })}><Plus size={14} />Exercice</button>
              {edit.exercises.map((ex, i) => (
                <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
                  {['name', 'sets', 'reps', 'weight'].map((k) => <input key={k} className="input" style={k === 'name' ? {} : { width: 64 }} placeholder={{ name: 'Exercice', sets: 'Séries', reps: 'Rép.', weight: 'kg' }[k]} value={ex[k]} onChange={(e) => setEdit({ ...edit, exercises: edit.exercises.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />)}
                  <button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => setEdit({ ...edit, exercises: edit.exercises.filter((_, j) => j !== i) })}><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SportHistory() {
  useStore();
  const t = today();
  const done = occurrences(store, addDays(t, -365), t).filter((o) => o.categoryId === 'sport' && o.status === 'done').reverse();
  const logs = store.list('logs').filter((l) => l.categoryId === 'sport').sort((a, b) => (a.date < b.date ? 1 : -1));
  const exNames = [...new Set(done.flatMap((o) => (o.results || o.exercises || []).map((e) => e.name)).filter(Boolean))];
  const [ex, setEx] = useState(exNames[0] || '');
  const series = done.slice().reverse().map((o) => { const e = (o.results || o.exercises || []).find((x) => x.name === ex); return e ? { label: fmtShort(o.date), value: Number(e.weight) || Number(e.reps) || null } : null; }).filter(Boolean);
  return (
    <div className="grid g2">
      <div className="card"><div className="card-head"><h3>Historique des séances</h3><button className="btn sm" onClick={() => openTimeLog({ categoryId: 'sport' })}><Plus size={14} />Activité libre</button></div>
        {done.length || logs.length ? <div className="list">
          {done.map((o) => <div key={o.key} className="list-row small"><span className="chip">{fmtShort(o.date)}</span><span style={{ flex: 1 }}>{o.title}</span><span className="muted">{o.actualMin != null ? fmtDuration(o.actualMin) : '—'}</span></div>)}
          {logs.map((l) => <div key={l.id} className="list-row small"><span className="chip">{fmtShort(l.date)}</span><span style={{ flex: 1 }}>{l.note || 'Activité physique'}</span><span className="muted">{fmtDuration(l.minutes)}</span><button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('logs', l.id)}><Trash2 size={13} /></button></div>)}
        </div> : <Empty>Les séances validées apparaîtront ici.</Empty>}
      </div>
      <div className="card"><div className="card-head"><h3>Progression par exercice</h3>{exNames.length > 0 && <select className="input" style={{ width: 180 }} value={ex} onChange={(e) => setEx(e.target.value)} aria-label="Exercice">{exNames.map((n) => <option key={n}>{n}</option>)}</select>}</div>
        {series.length > 1 ? <><Line data={series} name={`Progression ${ex}`} /><p className="xs muted">Charge (kg) ou, à défaut, répétitions réellement réalisées.</p></> : <Empty>Valide au moins deux séances avec cet exercice pour voir ta progression.</Empty>}
      </div>
    </div>
  );
}

export function Sport({ cat }) {
  const [tab, setTab] = useLocalState('sport-tab', 'calendrier');
  useStore();
  const t = today();
  const w = occurrences(store, startOfWeek(t), addDays(startOfWeek(t), 6)).filter((o) => o.type === 'seance');
  return (
    <div>
      <Title cat={cat} Icon={Dumbbell} />
      <div className="grid g3 mb">
        <div className="card stat"><span className="stat-label">Séances cette semaine</span><span className="stat-value">{w.filter((o) => o.status === 'done').length} / {w.length}</span><Progress value={w.length ? w.filter((o) => o.status === 'done').length / w.length : 0} color={cat.color} /></div>
        <div className="card stat"><span className="stat-label">Temps réel cette semaine</span><span className="stat-value">{fmtDuration(w.filter((o) => o.status === 'done').reduce((a, o) => a + (o.actualMin || 0), 0))}</span></div>
        <div className="card stat"><span className="stat-label">Non réalisées</span><span className="stat-value">{w.filter((o) => o.status !== 'done' && o.date < t).length}</span></div>
      </div>
      <div className="mb"><Tabs tabs={[['calendrier', 'Calendrier'], ['types', 'Séances types'], ['historique', 'Historique & progression'], ['objectifs', 'Objectifs']]} value={tab} onChange={setTab} /></div>
      {tab === 'calendrier' && <div className="grid g2"><CategoryAgenda categoryId="sport" title="Entraînements à venir" days={30} defaults={{ type: 'seance', durationMin: 45 }} /><CategoryStats categoryId="sport" /></div>}
      {tab === 'types' && <WorkoutTemplates />}
      {tab === 'historique' && <SportHistory />}
      {tab === 'objectifs' && <GoalsBlock categoryId="sport" title="Objectifs sportifs" defaults={{ metric: 'seances' }} />}
    </div>
  );
}

// ---------------- Beauté ----------------
function RoutineEditor({ r, onClose }) {
  const [f, setF] = useState(r);
  const save = () => {
    if (!f.name.trim()) return toast('Nomme la routine.');
    store.put('routines', { ...f, steps: f.steps.filter((s) => s.text.trim()) });
    onClose();
  };
  return (
    <Modal title={r.id ? 'Modifier la routine' : 'Nouvelle routine'} onClose={onClose} footer={<>
      {r.id && <button className="btn ghost danger" onClick={async () => { if (await confirmDialog({ title: 'Supprimer', message: 'Supprimer cette routine ?', confirm: 'Supprimer' })) { store.remove('routines', r.id); onClose(); } }}><Trash2 size={14} />Supprimer</button>}
      <span style={{ flex: 1 }} /><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Nom"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Nom de la routine" /></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{ROUTINE_KINDS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
        <Field label="Fréquence"><select className="input" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} aria-label="Fréquence"><option value="daily">Quotidienne</option><option value="weekly">Hebdomadaire</option><option value="once">Ponctuelle</option></select></Field>
        {f.frequency === 'once' && <Field label="Date"><input className="input" type="date" value={f.date || today()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>}
        {f.frequency === 'weekly' && <div className="full row wrap" style={{ gap: 6 }}>{[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = (f.days || []).includes(d); return <button key={d} type="button" className={'btn sm' + (on ? ' primary' : '')} onClick={() => setF({ ...f, days: on ? f.days.filter((x) => x !== d) : [...(f.days || []), d] })}>{WEEKDAYS_LONG[d].slice(0, 3)}</button>; })}</div>}
        <div className="full">
          <div className="row between"><span className="small" style={{ fontWeight: 500 }}>Étapes</span><button type="button" className="btn sm" onClick={() => setF({ ...f, steps: [...f.steps, { id: uid(), text: '' }] })}><Plus size={14} />Étape</button></div>
          {f.steps.map((s, i) => (
            <div key={s.id} className="row" style={{ marginTop: 6 }}>
              <input className="input" value={s.text} placeholder={`Étape ${i + 1} (ex. nettoyant doux)`} onChange={(e) => setF({ ...f, steps: f.steps.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) })} aria-label={`Étape ${i + 1}`} />
              <button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => setF({ ...f, steps: f.steps.filter((x) => x.id !== s.id) })}><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function Beauty({ cat }) {
  useStore();
  const [edit, setEdit] = useState(null);
  const [date, setDate] = useState(today());
  const routines = store.list('routines');
  const t = today();
  const last14 = rangeDays(addDays(t, -13), t);
  return (
    <div>
      <Title cat={cat} Icon={Flower2} />
      <div className="grid cols-2-1">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Mes routines du jour</h3><input className="input" type="date" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value || t)} aria-label="Date" /></div>
            {routines.filter((r) => routineDue(r, date)).length ? <div className="grid g2">{routines.filter((r) => routineDue(r, date)).map((r) => <RoutineCard key={r.id} r={r} date={date} />)}</div> : <Empty>Aucune routine prévue ce jour-là.</Empty>}
          </div>
          <CategoryAgenda categoryId="beaute" title="Rendez-vous et soins ponctuels" days={60} defaults={{ type: 'rdv' }} />
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Toutes mes routines</h3><button className="btn sm" onClick={() => setEdit({ name: '', kind: 'matin', frequency: 'daily', days: [], steps: [{ id: uid(), text: '' }] })}><Plus size={14} />Routine</button></div>
            {routines.length ? <div className="list">{routines.map((r) => {
              const due = last14.filter((d) => routineDue(r, d));
              const done = due.filter((d) => store.get('routineLogs', `${r.id}@${d}`)?.done).length;
              return (
                <div key={r.id} className="list-row">
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{r.name}</div><div className="xs muted">{ROUTINE_KINDS.find((k) => k[0] === r.kind)?.[1]} · {r.frequency === 'daily' ? 'quotidienne' : r.frequency === 'weekly' ? (r.days || []).map((d) => WEEKDAYS_LONG[d].slice(0, 3)).join(', ') : 'ponctuelle'} · {due.length ? `${done}/${due.length} sur 14 j` : ''}</div></div>
                  <button className="btn ghost icon sm" aria-label={`Modifier ${r.name}`} onClick={() => setEdit(r)}><Pencil size={14} /></button>
                </div>
              );
            })}</div> : <Empty>Crée tes routines (matin, soir, skincare, cheveux, corps…) avec tes propres étapes.</Empty>}
          </div>
          <GoalsBlock categoryId="beaute" title="Objectifs beauté & soins" />
        </div>
      </div>
      {edit && <RoutineEditor r={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

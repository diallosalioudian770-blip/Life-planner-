import { useState } from 'react';
import { Plus, Trash2, Pencil, X, FolderKanban, Briefcase, Languages as LangIcon, Moon, BookOpen, Tag, ChevronLeft, ExternalLink, Timer, Star } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { languageMinutes, habitStats, habitStreak, habitDone, logsIn } from '../lib/stats.js';
import { occurrences } from '../lib/recurrence.js';
import { JOB_STATUS, LANGUAGE_SKILLS } from '../lib/defaults.js';
import { today, addDays, startOfWeek, weekDays, WEEKDAYS_SHORT, WEEKDAYS_LONG, fmtShort, fmtHours, rangeDays, toMin, fmtDuration } from '../lib/date.js';
import { PageHead, Tabs, Field, Empty, Progress, Modal, useSettings, toast, useLocalState, confirmDialog, Check2 } from '../components/ui.jsx';
import { CategoryAgenda, GoalsBlock, ListBlock, CategoryStats } from '../components/blocks.jsx';
import { openTimeLog } from '../components/items.jsx';
import { Bars, HBars } from '../components/charts.jsx';
import { setHabit } from './HabitsWidgets.jsx';

const Title = ({ cat, Icon, eyebrow, children }) => <PageHead eyebrow={eyebrow} title={<span className="row"><Icon size={26} style={{ color: cat.color }} />{cat.name}</span>}>{children}</PageHead>;
const PROJECT_STATUS = [['idee', 'Idée'], ['en_cours', 'En cours'], ['pause', 'En pause'], ['termine', 'Terminé']];

// ---------------- Projets ----------------
function ProjectDetail({ p, onBack }) {
  useStore();
  const upd = (x) => store.put('projects', { id: p.id, ...x });
  const steps = p.steps || [];
  const [step, setStep] = useState({ title: '', due: '' });
  const [link, setLink] = useState({ label: '', url: '' });
  return (
    <div className="stack">
      <div className="row wrap"><button className="btn sm" onClick={onBack}><ChevronLeft size={14} />Tous les projets</button><h2 style={{ flex: 1 }}>{p.name}</h2>
        <button className="btn sm danger" onClick={async () => { if (await confirmDialog({ title: 'Supprimer le projet', message: `Supprimer « ${p.name} » ?`, confirm: 'Supprimer' })) { store.remove('projects', p.id); onBack(); } }}><Trash2 size={14} />Supprimer</button></div>
      <div className="card">
        <div className="form-grid">
          <Field label="Nom du projet"><input className="input" defaultValue={p.name} onBlur={(e) => upd({ name: e.target.value })} /></Field>
          <Field label="Statut"><select className="input" value={p.status || 'idee'} onChange={(e) => upd({ status: e.target.value })}>{PROJECT_STATUS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
          <Field label="Date limite"><input className="input" type="date" defaultValue={p.deadline || ''} onBlur={(e) => upd({ deadline: e.target.value || null })} /></Field>
          <Field label="Avancement" group><div><Progress value={steps.length ? steps.filter((s) => s.done).length / steps.length : 0} color="var(--gold)" /><span className="xs muted">{steps.filter((s) => s.done).length}/{steps.length} étapes terminées</span></div></Field>
          <Field label="Description" full><textarea className="input" rows={3} defaultValue={p.description || ''} onBlur={(e) => upd({ description: e.target.value })} /></Field>
          <Field label="Objectifs" full><textarea className="input" rows={3} defaultValue={p.objectives || ''} onBlur={(e) => upd({ objectives: e.target.value })} /></Field>
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Étapes</h3></div>
          <form className="row mb" onSubmit={(e) => { e.preventDefault(); if (!step.title.trim()) return; upd({ steps: [...steps, { id: uid(), title: step.title.trim(), due: step.due || null, done: false }] }); setStep({ title: '', due: '' }); }}>
            <input className="input" value={step.title} onChange={(e) => setStep({ ...step, title: e.target.value })} placeholder="Nouvelle étape" aria-label="Nouvelle étape" />
            <input className="input" type="date" style={{ width: 150 }} value={step.due} onChange={(e) => setStep({ ...step, due: e.target.value })} aria-label="Échéance de l'étape" />
            <button className="btn primary icon" aria-label="Ajouter l'étape"><Plus size={16} /></button>
          </form>
          <div className="list">{steps.map((s) => (
            <div key={s.id} className="list-row">
              <Check2 on={s.done} onClick={() => upd({ steps: steps.map((x) => (x.id === s.id ? { ...x, done: !x.done, doneDate: !x.done ? today() : null } : x)) })} label={s.title} />
              <span style={{ flex: 1 }} className={s.done ? 'done-text' : ''}>{s.title}</span>
              {s.due && <span className={'chip' + (!s.done && s.due < today() ? ' prio-haute' : '')}>{fmtShort(s.due)}</span>}
              <button className="btn ghost icon sm" aria-label="Supprimer l'étape" onClick={() => upd({ steps: steps.filter((x) => x.id !== s.id) })}><Trash2 size={14} /></button>
            </div>
          ))}</div>
        </div>
        <CategoryAgenda categoryId="projets" filter={(o) => o.projectId === p.id} title="Tâches du projet" days={90} defaults={{ projectId: p.id }} />
      </div>
      <div className="grid g3">
        <div className="card"><div className="card-head"><h3>Notes</h3></div><textarea className="input" rows={6} defaultValue={p.notes || ''} onBlur={(e) => upd({ notes: e.target.value })} /></div>
        <div className="card"><div className="card-head"><h3>Idées</h3></div><textarea className="input" rows={6} defaultValue={p.ideas || ''} onBlur={(e) => upd({ ideas: e.target.value })} /></div>
        <div className="card"><div className="card-head"><h3>Documents et liens</h3></div>
          <form className="stack-sm mb" onSubmit={(e) => { e.preventDefault(); if (!link.url.trim()) return; upd({ links: [...(p.links || []), { id: uid(), label: link.label || link.url, url: link.url.trim() }] }); setLink({ label: '', url: '' }); }}>
            <input className="input" value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} placeholder="Nom (ex. Moodboard)" />
            <div className="row"><input className="input" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://…" /><button className="btn icon primary" aria-label="Ajouter le lien"><Plus size={16} /></button></div>
          </form>
          {(p.links || []).map((l) => <div key={l.id} className="list-row small"><a href={l.url} target="_blank" rel="noreferrer" style={{ flex: 1 }} className="row"><ExternalLink size={13} />{l.label}</a><button className="btn ghost icon sm" aria-label="Retirer" onClick={() => upd({ links: p.links.filter((x) => x.id !== l.id) })}><X size={13} /></button></div>)}
        </div>
      </div>
    </div>
  );
}

export function Projects({ cat }) {
  const projects = useStore((s) => s.list('projects')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const [sel, setSel] = useLocalState('project', null);
  const [name, setName] = useState('');
  const current = projects.find((p) => p.id === sel);
  return (
    <div>
      <Title cat={cat} Icon={FolderKanban} eyebrow="Priorités 4 et 5" />
      {current ? <ProjectDetail p={current} onBack={() => setSel(null)} /> : (
        <div className="stack">
          <div className="grid g-auto">
            {projects.map((p) => { const s = p.steps || []; return (
              <button key={p.id} className="card space-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setSel(p.id)}>
                <div className="row between"><strong>{p.name}</strong><span className="chip">{PROJECT_STATUS.find((x) => x[0] === (p.status || 'idee'))?.[1]}</span></div>
                <p className="small muted" style={{ minHeight: 20 }}>{p.description ? p.description.slice(0, 90) : 'Pas encore de description.'}</p>
                <Progress value={s.length ? s.filter((x) => x.done).length / s.length : 0} color="var(--gold)" />
                <span className="xs muted">{s.filter((x) => x.done).length}/{s.length} étapes{p.deadline ? ` · avant le ${fmtShort(p.deadline)}` : ''}</span>
              </button>
            ); })}
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const p = store.put('projects', { name: name.trim(), status: 'idee', steps: [], links: [], createdAt: Date.now() }); setName(''); setSel(p.id); }}>
            <input className="input" style={{ maxWidth: 340 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau projet" aria-label="Nouveau projet" />
            <button className="btn primary"><Plus size={15} />Créer</button>
          </form>
          <div className="grid g2"><ListBlock space="business-idees" title="Idées de business" placeholder="Ex. Stickers d'étude sur Etsy" /><GoalsBlock categoryId="projets" title="Objectifs d'indépendance et long terme" defaults={{ horizon: 'long' }} /></div>
        </div>
      )}
    </div>
  );
}

// ---------------- Carrière ----------------
function JobModal({ job, onClose }) {
  const [f, setF] = useState(job);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={job.id ? 'Candidature' : 'Nouvelle candidature'} onClose={onClose} footer={<>
      {job.id && <button className="btn ghost danger" onClick={() => { store.remove('jobs', job.id); onClose(); }}><Trash2 size={14} />Supprimer</button>}
      <span style={{ flex: 1 }} /><button className="btn ghost" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={() => { if (!f.company?.trim()) return toast("Indique l'entreprise."); store.put('jobs', f); onClose(); }}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Entreprise"><input className="input" value={f.company || ''} onChange={(e) => set('company', e.target.value)} aria-label="Entreprise" /></Field>
        <Field label="Poste"><input className="input" value={f.position || ''} onChange={(e) => set('position', e.target.value)} /></Field>
        <Field label="Statut"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>{JOB_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label="Date de candidature"><input className="input" type="date" value={f.dateApplied || ''} onChange={(e) => set('dateApplied', e.target.value)} /></Field>
        <Field label="Lien de l'offre" full><input className="input" value={f.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></Field>
        <Field label="Réponse reçue" full><input className="input" value={f.response || ''} onChange={(e) => set('response', e.target.value)} /></Field>
        <div className="full">
          <div className="row between"><span className="small" style={{ fontWeight: 500 }}>Entretiens</span><button type="button" className="btn sm" onClick={() => set('interviews', [...(f.interviews || []), { id: uid(), date: today(), notes: '' }])}><Plus size={14} />Entretien</button></div>
          {(f.interviews || []).map((iv) => (
            <div key={iv.id} className="row" style={{ marginTop: 6 }}>
              <input className="input" type="date" style={{ width: 150 }} value={iv.date} onChange={(e) => set('interviews', f.interviews.map((x) => (x.id === iv.id ? { ...x, date: e.target.value } : x)))} />
              <input className="input" value={iv.notes} placeholder="Notes" onChange={(e) => set('interviews', f.interviews.map((x) => (x.id === iv.id ? { ...x, notes: e.target.value } : x)))} />
              <button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => set('interviews', f.interviews.filter((x) => x.id !== iv.id))}><X size={14} /></button>
            </div>
          ))}
        </div>
        <Field label="Notes" full><textarea className="input" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DocLinks() {
  const docs = useStore((s) => s.list('lists')).filter((l) => l.space === 'carriere-docs');
  const [f, setF] = useState({ text: '', url: '' });
  return (
    <div className="card"><div className="card-head"><h3>CV et lettres de motivation</h3></div>
      <p className="small muted mb">Ajoute un lien vers tes documents (Google Drive, iCloud, OneDrive…). Le stockage de fichiers dans l'application n'est pas encore disponible.</p>
      <form className="row wrap mb" onSubmit={(e) => { e.preventDefault(); if (!f.text.trim()) return; store.put('lists', { space: 'carriere-docs', text: f.text.trim(), url: f.url.trim(), createdAt: Date.now() }); setF({ text: '', url: '' }); }}>
        <input className="input" style={{ flex: '1 1 160px' }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Ex. CV — version 2026" />
        <input className="input" style={{ flex: '1 1 200px' }} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Lien (facultatif)" />
        <button className="btn primary icon" aria-label="Ajouter"><Plus size={16} /></button>
      </form>
      {docs.map((d) => <div key={d.id} className="list-row small">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>{d.text}</a> : <span style={{ flex: 1 }}>{d.text}</span>}<button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('lists', d.id)}><Trash2 size={13} /></button></div>)}
    </div>
  );
}

export function Career({ cat }) {
  const [tab, setTab] = useLocalState('career-tab', 'candidatures');
  const jobs = useStore((s) => s.list('jobs'));
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <Title cat={cat} Icon={Briefcase}><Tabs tabs={[['candidatures', 'Candidatures'], ['documents', 'Documents'], ['competences', 'Compétences & objectifs']]} value={tab} onChange={setTab} /></Title>
      {tab === 'candidatures' && (
        <div className="stack">
          <div className="row"><button className="btn primary" onClick={() => setEdit({ status: 'reperee', dateApplied: '', interviews: [] })}><Plus size={15} />Offre ou candidature</button><span className="small muted">{jobs.length} au total · {jobs.filter((j) => j.status === 'entretien').length} entretien(s)</span></div>
          <div className="kanban">
            {JOB_STATUS.map((s) => (
              <div key={s.id} className="card flat" style={{ background: 'var(--surface-2)', padding: 10 }}>
                <div className="row between mb" style={{ marginBottom: 6 }}><strong className="small">{s.label}</strong><span className="chip">{jobs.filter((j) => j.status === s.id).length}</span></div>
                <div className="stack-sm">{jobs.filter((j) => j.status === s.id).map((j) => (
                  <button key={j.id} className="card" style={{ padding: 10, textAlign: 'left', cursor: 'pointer' }} onClick={() => setEdit(j)}>
                    <strong className="small">{j.company}</strong><div className="xs muted">{j.position}{j.dateApplied ? ` · ${fmtShort(j.dateApplied)}` : ''}</div>
                    {(j.interviews || []).length > 0 && <div className="xs">Entretien : {fmtShort(j.interviews[j.interviews.length - 1].date)}</div>}
                  </button>
                ))}</div>
              </div>
            ))}
          </div>
          <CategoryAgenda categoryId="carriere" title="Entretiens et rendez-vous" days={60} defaults={{ type: 'rdv' }} />
        </div>
      )}
      {tab === 'documents' && <DocLinks />}
      {tab === 'competences' && <div className="grid g2"><ListBlock space="competences" title="Compétences à développer" placeholder="Ex. Excel avancé" /><GoalsBlock categoryId="carriere" title="Objectifs professionnels" defaults={{ horizon: 'annee' }} /></div>}
      {edit && <JobModal job={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------------- Langues ----------------
function Vocab({ lang }) {
  const words = useStore((s) => s.list('vocab')).filter((w) => w.languageId === lang.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const [f, setF] = useState({ term: '', translation: '', example: '' });
  const [q, setQ] = useState('');
  const shown = words.filter((w) => !q || (w.term + w.translation).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card"><div className="card-head"><h3>Vocabulaire</h3><span className="small muted">{words.filter((w) => w.mastered).length}/{words.length} maîtrisés</span></div>
      <form className="row wrap mb" onSubmit={(e) => { e.preventDefault(); if (!f.term.trim()) return; store.put('vocab', { ...f, languageId: lang.id, mastered: false, createdAt: Date.now() }); setF({ term: '', translation: '', example: '' }); }}>
        <input className="input" style={{ flex: '1 1 120px' }} value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} placeholder={`Mot en ${lang.name.toLowerCase()}`} aria-label="Mot" />
        <input className="input" style={{ flex: '1 1 120px' }} value={f.translation} onChange={(e) => setF({ ...f, translation: e.target.value })} placeholder="Traduction" aria-label="Traduction" />
        <input className="input" style={{ flex: '2 1 160px' }} value={f.example} onChange={(e) => setF({ ...f, example: e.target.value })} placeholder="Exemple (facultatif)" />
        <button className="btn primary icon" aria-label="Ajouter le mot"><Plus size={16} /></button>
      </form>
      {words.length > 8 && <input className="input mb" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" />}
      <div className="list" style={{ maxHeight: 380, overflowY: 'auto' }}>{shown.map((w) => (
        <div key={w.id} className="list-row small">
          <Check2 on={w.mastered} onClick={() => store.put('vocab', { id: w.id, mastered: !w.mastered })} label={`${w.term} maîtrisé`} />
          <strong>{w.term}</strong><span className="muted">— {w.translation}</span><span className="xs muted ellipsis" style={{ flex: 1 }}>{w.example}</span>
          <button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('vocab', w.id)}><Trash2 size={13} /></button>
        </div>
      ))}</div>
    </div>
  );
}

function LanguagePanel({ lang }) {
  useStore();
  const t = today();
  const from = startOfWeek(t);
  const week = languageMinutes(store, from, addDays(from, 6))[lang.id] || 0;
  const goal = lang.weeklyGoalMin;
  const upd = (p) => store.put('languages', { id: lang.id, ...p });
  const fourW = addDays(from, -21);
  const skills = Object.fromEntries(LANGUAGE_SKILLS.map(([k]) => [k, 0]));
  for (const l of logsIn(store, fourW, t)) if (l.languageId === lang.id) skills[l.skill || 'exercices'] = (skills[l.skill || 'exercices'] || 0) + Number(l.minutes);
  for (const o of occurrences(store, fourW, t)) if (o.languageId === lang.id && o.status === 'done') { const sk = o.item.skill || 'exercices'; skills[sk] = (skills[sk] || 0) + (Number(o.actualMin) || 0); }
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(from, -7 * (7 - i)));
  const notes = lang.notes || {};
  return (
    <div className="stack">
      <div className="grid g3">
        <div className="card stat"><span className="stat-label">Cette semaine</span><span className="stat-value">{fmtHours(week)}</span>{goal ? <Progress value={week / goal} color="var(--primary)" /> : null}</div>
        <div className="card"><Field label="Objectif hebdomadaire (minutes)"><input className="input" type="number" step="15" defaultValue={goal ?? ''} onBlur={(e) => upd({ weeklyGoalMin: e.target.value === '' ? null : Number(e.target.value) })} aria-label={`Objectif hebdomadaire ${lang.name}`} /></Field></div>
        <div className="card row"><button className="btn primary" onClick={() => openTimeLog({ categoryId: 'langues', languageId: lang.id })}><Timer size={15} />Noter du temps</button></div>
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><h3>Temps par compétence (4 semaines)</h3></div><HBars data={LANGUAGE_SKILLS.map(([k, l]) => ({ label: l, value: skills[k] || 0 }))} format={(v) => fmtDuration(v)} /></div>
        <div className="card"><div className="card-head"><h3>Progression (heures / semaine)</h3></div><Bars data={weeks.map((w) => ({ label: fmtShort(w).split(' ')[0] + '/' + (new Date(w).getMonth() + 1), value: (languageMinutes(store, w, addDays(w, 6))[lang.id] || 0) / 60 }))} format={(v) => `${Math.round(v * 10) / 10}h`} name={`Heures de ${lang.name}`} /></div>
      </div>
      <div className="grid g2">
        <Vocab lang={lang} />
        <div className="stack">
          <GoalsBlock categoryId="langues" horizon="semaine" title={`Objectifs de la semaine — ${lang.name}`} defaults={{ horizon: 'semaine', title: '' }} />
          <ListBlock space={`lang-ex-${lang.id}`} title="Exercices à faire" placeholder="Ex. Workbook p. 32" />
        </div>
      </div>
      <div className="grid g3">
        {[['grammaire', 'Grammaire'], ['conjugaison', 'Conjugaison'], ['cours', 'Notes de cours']].map(([k, l]) => (
          <div key={k} className="card"><div className="card-head"><h3>{l}</h3></div><textarea className="input" rows={8} defaultValue={notes[k] || ''} onBlur={(e) => upd({ notes: { ...(store.get('languages', lang.id)?.notes || {}), [k]: e.target.value } })} /></div>
        ))}
      </div>
      <div className="grid g2">
        <ListBlock space={`lang-oral-${lang.id}`} title="Compréhension orale (podcasts, séries…)" placeholder="Ex. Podcast épisode 3" />
        <ListBlock space={`lang-ecrit-${lang.id}`} title="Compréhension écrite (articles, livres…)" placeholder="Ex. Article The Guardian" />
      </div>
      <CategoryAgenda categoryId="langues" filter={(o) => o.languageId === lang.id} title="Séances prévues" days={21} defaults={{ type: 'langue', languageId: lang.id, title: `${lang.name} — ` }} />
    </div>
  );
}

export function Languages({ cat }) {
  const langs = useStore((s) => s.list('languages'));
  const [sel, setSel] = useLocalState('lang', langs[0]?.id);
  const [name, setName] = useState('');
  const current = langs.find((l) => l.id === sel) || langs[0];
  return (
    <div>
      <Title cat={cat} Icon={LangIcon}>
        <Tabs tabs={langs.map((l) => [l.id, l.name])} value={current?.id} onChange={setSel} />
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const l = store.put('languages', { name: name.trim(), notes: {} }); setName(''); setSel(l.id); }}>
          <input className="input" style={{ width: 150 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Autre langue" aria-label="Ajouter une langue" />
          <button className="btn icon" aria-label="Ajouter la langue"><Plus size={16} /></button>
        </form>
      </Title>
      {current ? <LanguagePanel lang={current} key={current.id} /> : <Empty>Ajoute une langue.</Empty>}
    </div>
  );
}

// ---------------- Habitudes & sommeil ----------------
function HabitModal({ h, onClose }) {
  const [f, setF] = useState(h);
  const sch = f.schedule || { type: 'daily' };
  return (
    <Modal title={h.id ? "Modifier l'habitude" : 'Nouvelle habitude'} onClose={onClose} footer={<>
      {h.id && <button className="btn ghost danger" onClick={async () => { if (await confirmDialog({ title: 'Supprimer', message: `Supprimer l'habitude « ${h.name} » et son historique ?`, confirm: 'Supprimer' })) { store.remove('habits', h.id); onClose(); } }}><Trash2 size={14} />Supprimer</button>}
      {h.id && <button className="btn ghost" onClick={() => { store.put('habits', { id: h.id, archived: !h.archived }); onClose(); }}>{h.archived ? 'Réactiver' : 'Mettre en pause'}</button>}
      <span style={{ flex: 1 }} /><button className="btn ghost" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={() => { if (!f.name?.trim()) return toast("Nomme l'habitude."); store.put('habits', { ...f, name: f.name.trim(), target: f.target ? Number(f.target) : null, createdDate: f.createdDate || today() }); onClose(); }}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Habitude" full><input className="input" autoFocus value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Lire 10 pages, moins de réseaux sociaux…" aria-label="Nom de l'habitude" /></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="build">À construire</option><option value="reduce">À réduire</option></select></Field>
        <Field label="Fréquence"><select className="input" value={sch.type} onChange={(e) => setF({ ...f, schedule: { ...sch, type: e.target.value } })}><option value="daily">Tous les jours</option><option value="days">Certains jours</option><option value="weekly">X fois par semaine</option></select></Field>
        {sch.type === 'days' && <div className="full row wrap" style={{ gap: 6 }}>{[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = (sch.days || []).includes(d); return <button key={d} type="button" className={'btn sm' + (on ? ' primary' : '')} onClick={() => setF({ ...f, schedule: { ...sch, days: on ? sch.days.filter((x) => x !== d) : [...(sch.days || []), d] } })}>{WEEKDAYS_LONG[d].slice(0, 3)}</button>; })}</div>}
        {sch.type === 'weekly' && <Field label="Fois par semaine"><input className="input" type="number" min="1" max="7" value={sch.timesPerWeek || 3} onChange={(e) => setF({ ...f, schedule: { ...sch, timesPerWeek: Number(e.target.value) } })} /></Field>}
        <Field label="Quantité par jour (facultatif)"><input className="input" type="number" value={f.target || ''} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Ex. 8" /></Field>
        <Field label="Unité"><input className="input" value={f.unit || ''} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="verres, pages, min…" /></Field>
      </div>
      {f.kind === 'reduce' && <p className="xs muted mt">Pour une habitude à réduire, coche la case les jours où tu as réussi à la limiter.</p>}
    </Modal>
  );
}

function SleepLog() {
  useStore();
  const t = today();
  const [f, setF] = useState({ date: t, bed: '', wake: '', quality: 3, restMin: '', notes: '' });
  const logs = store.list('sleep').sort((a, b) => (a.date < b.date ? 1 : -1));
  const hours = (l) => { if (!l.bed || !l.wake) return null; let m = toMin(l.wake) - toMin(l.bed); if (m <= 0) m += 1440; return m / 60; };
  const last = rangeDays(addDays(t, -13), t).map((d) => { const l = store.get('sleep', 's:' + d); return { label: fmtShort(d).split(' ')[0], value: l ? hours(l) || 0 : 0 }; });
  const withH = logs.slice(0, 14).map(hours).filter((x) => x != null);
  return (
    <div className="grid g2">
      <form className="card" onSubmit={(e) => { e.preventDefault(); store.put('sleep', { ...f, id: 's:' + f.date, restMin: f.restMin === '' ? null : Number(f.restMin) }); toast('Nuit enregistrée.'); }}>
        <div className="card-head"><h3><Moon size={18} />Noter ma nuit</h3></div>
        <p className="small muted mb">Aucune heure n'est imposée : note simplement tes heures réelles pour observer ton rythme.</p>
        <div className="form-grid">
          <Field label="Réveil le"><input className="input" type="date" value={f.date} onChange={(e) => { const l = store.get('sleep', 's:' + e.target.value); setF(l ? { ...f, ...l } : { ...f, date: e.target.value }); }} /></Field>
          <Field label="Qualité"><select className="input" value={f.quality} onChange={(e) => setF({ ...f, quality: Number(e.target.value) })}>{['Très mauvaise', 'Mauvaise', 'Correcte', 'Bonne', 'Excellente'].map((q, i) => <option key={q} value={i + 1}>{q}</option>)}</select></Field>
          <Field label="Coucher"><input className="input" type="time" value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} aria-label="Heure de coucher" /></Field>
          <Field label="Lever"><input className="input" type="time" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} aria-label="Heure de lever" /></Field>
          <Field label="Sieste / repos (min)"><input className="input" type="number" value={f.restMin} onChange={(e) => setF({ ...f, restMin: e.target.value })} /></Field>
          <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <button className="btn primary mt" style={{ width: '100%' }}>Enregistrer</button>
      </form>
      <div className="card"><div className="card-head"><h3>Sommeil, 14 derniers jours</h3><span className="small muted">{withH.length ? `moyenne ${(withH.reduce((a, b) => a + b, 0) / withH.length).toFixed(1)} h` : ''}</span></div>
        <Bars data={last} format={(v) => `${Math.round(v * 10) / 10}h`} name="Heures de sommeil" color="var(--navy)" />
        <div className="list mt">{logs.slice(0, 7).map((l) => <div key={l.id} className="list-row small"><span className="chip">{fmtShort(l.date)}</span><span style={{ flex: 1 }}>{l.bed || '?'} → {l.wake || '?'} {hours(l) != null && <strong>· {hours(l).toFixed(1)} h</strong>}{l.restMin ? ` · repos ${l.restMin} min` : ''}</span><span className="muted">{'★'.repeat(l.quality || 0)}</span><button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => store.remove('sleep', l.id)}><Trash2 size={13} /></button></div>)}</div>
      </div>
    </div>
  );
}

export function Habits({ cat }) {
  const [tab, setTab] = useLocalState('habit-tab', 'habitudes');
  useStore();
  const [edit, setEdit] = useState(null);
  const t = today();
  const days = weekDays(t);
  const habits = store.list('habits').sort((a, b) => (a.archived - b.archived) || (a.createdAt || 0) - (b.createdAt || 0));
  const month = habitStats(store, addDays(t, -29), t);
  return (
    <div>
      <Title cat={cat} Icon={Moon}><Tabs tabs={[['habitudes', 'Habit tracker'], ['sommeil', 'Sommeil & repos'], ['objectifs', 'Objectifs']]} value={tab} onChange={setTab} /></Title>
      {tab === 'habitudes' && (
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Cette semaine</h3><button className="btn sm primary" onClick={() => setEdit({ kind: 'build', schedule: { type: 'daily' }, categoryId: 'habitudes' })}><Plus size={14} />Habitude</button></div>
            {habits.length ? (
              <div className="table-wrap"><table className="table" data-testid="habit-table">
                <thead><tr><th>Habitude</th>{days.map((d, i) => <th key={d} className="center" style={d === t ? { color: 'var(--primary)' } : null}>{WEEKDAYS_SHORT[i]}</th>)}<th>Série</th><th>30 j</th><th /></tr></thead>
                <tbody>{habits.map((h) => {
                  const s = month.per.find((p) => p.habit.id === h.id);
                  return (
                    <tr key={h.id} style={h.archived ? { opacity: 0.5 } : null}>
                      <td><div style={{ fontWeight: 500 }}>{h.name}</div><div className="xs muted">{h.kind === 'reduce' ? 'à réduire' : 'à construire'}{h.target ? ` · ${h.target} ${h.unit || ''}/jour` : ''}{h.schedule?.type === 'weekly' ? ` · ${h.schedule.timesPerWeek}×/sem.` : ''}</div></td>
                      {days.map((d) => {
                        const log = store.get('habitLogs', `${h.id}@${d}`);
                        const due = h.schedule?.type !== 'days' || (h.schedule.days || []).includes(new Date(d + 'T12:00').getDay());
                        const done = habitDone(h, log);
                        return (
                          <td key={d} className="center">
                            {due && !h.archived && d <= t ? (h.target && h.unit
                              ? <button className={'btn sm' + (done ? ' primary' : '')} style={{ minWidth: 40, padding: 0 }} onClick={() => setHabit(h, d, (Number(log?.value) || 0) + 1)} onContextMenu={(e) => { e.preventDefault(); setHabit(h, d, Math.max(0, (Number(log?.value) || 0) - 1)); }} title="Clic : +1 · clic droit : −1">{Number(log?.value) || 0}</button>
                              : <Check2 on={done} onClick={() => setHabit(h, d, done ? 0 : 1)} label={`${h.name} le ${d}`} />)
                              : <span className="muted">·</span>}
                          </td>
                        );
                      })}
                      <td className="small">{habitStreak(store, h, t)} j</td>
                      <td style={{ minWidth: 90 }}>{s?.rate != null ? <><Progress value={s.rate} color={cat.color} /><span className="xs muted">{Math.round(s.rate * 100)} %</span></> : '—'}</td>
                      <td><button className="btn ghost icon sm" aria-label={`Modifier ${h.name}`} onClick={() => setEdit(h)}><Pencil size={14} /></button></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            ) : <Empty title="Aucune habitude">Ajoute les habitudes que tu veux construire ou réduire. Tu peux les modifier ou les supprimer à tout moment.</Empty>}
          </div>
          <div className="grid g3">
            <div className="card stat"><span className="stat-label">Réalisation sur 30 jours</span><span className="stat-value">{month.rate != null ? Math.round(month.rate * 100) + ' %' : '—'}</span></div>
            <div className="card stat"><span className="stat-label">Habitudes actives</span><span className="stat-value">{habits.filter((h) => !h.archived).length}</span></div>
            <div className="card stat"><span className="stat-label">Validations sur 30 jours</span><span className="stat-value">{month.done}</span></div>
          </div>
        </div>
      )}
      {tab === 'sommeil' && <SleepLog />}
      {tab === 'objectifs' && <GoalsBlock categoryId="habitudes" title="Mes objectifs d'habitudes et de routines" />}
      {edit && <HabitModal h={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------------- Lecture ----------------
function BookModal({ b, onClose }) {
  const [f, setF] = useState(b);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [quote, setQuote] = useState('');
  return (
    <Modal wide title={b.id ? f.title || 'Livre' : 'Nouveau livre'} onClose={onClose} footer={<>
      {b.id && <button className="btn ghost danger" onClick={() => { store.remove('books', b.id); onClose(); }}><Trash2 size={14} />Supprimer</button>}
      <span style={{ flex: 1 }} /><button className="btn ghost" onClick={onClose}>Annuler</button>
      <button className="btn primary" onClick={() => { if (!f.title?.trim()) return toast('Indique le titre.'); const endDate = f.status === 'done' ? f.endDate || today() : f.endDate; store.put('books', { ...f, endDate, createdAt: f.createdAt || Date.now() }); onClose(); }}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Titre"><input className="input" autoFocus value={f.title || ''} onChange={(e) => set('title', e.target.value)} aria-label="Titre du livre" /></Field>
        <Field label="Auteur·rice"><input className="input" value={f.author || ''} onChange={(e) => set('author', e.target.value)} /></Field>
        <Field label="Statut"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Statut du livre"><option value="to_read">À lire</option><option value="reading">En cours</option><option value="done">Terminé</option></select></Field>
        <Field label="Note personnelle" group><div className="row">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="btn ghost icon sm" aria-label={`${n} étoiles`} onClick={() => set('rating', n)}><Star size={16} fill={(f.rating || 0) >= n ? 'currentColor' : 'none'} style={{ color: 'var(--gold)' }} /></button>)}</div></Field>
        <Field label="Pages"><input className="input" type="number" value={f.pages || ''} onChange={(e) => set('pages', Number(e.target.value) || null)} /></Field>
        <Field label="Page actuelle"><input className="input" type="number" value={f.currentPage || ''} onChange={(e) => set('currentPage', Number(e.target.value) || 0)} /></Field>
        <Field label="Commencé le"><input className="input" type="date" value={f.startDate || ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Terminé le"><input className="input" type="date" value={f.endDate || ''} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Notes de lecture" full><textarea className="input" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Field label="Ce que j'ai appris" full><textarea className="input" value={f.learnings || ''} onChange={(e) => set('learnings', e.target.value)} /></Field>
        <Field label="Réflexions personnelles" full><textarea className="input" value={f.reflections || ''} onChange={(e) => set('reflections', e.target.value)} /></Field>
        <div className="full">
          <span className="small" style={{ fontWeight: 500 }}>Citations préférées</span>
          <div className="row" style={{ marginTop: 6 }}><input className="input" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Une phrase qui t'a marquée" /><button type="button" className="btn icon" aria-label="Ajouter la citation" onClick={() => { if (quote.trim()) { set('quotes', [...(f.quotes || []), quote.trim()]); setQuote(''); } }}><Plus size={16} /></button></div>
          {(f.quotes || []).map((q, i) => <div key={i} className="list-row"><span className="serif italic" style={{ flex: 1, fontSize: '1.05rem' }}>“{q}”</span><button type="button" className="btn ghost icon sm" aria-label="Retirer" onClick={() => set('quotes', f.quotes.filter((_, j) => j !== i))}><X size={13} /></button></div>)}
        </div>
      </div>
    </Modal>
  );
}

export function Reading({ cat }) {
  useStore();
  const settings = useSettings();
  const books = store.list('books');
  const [edit, setEdit] = useState(null);
  const y = today().slice(0, 4);
  const doneYear = books.filter((b) => b.status === 'done' && b.endDate?.startsWith(y)).length;
  const goal = settings.readingGoalPerYear;
  const col = (status, label) => (
    <div className="card flat" style={{ background: 'var(--surface-2)', padding: 12 }}>
      <div className="row between mb" style={{ marginBottom: 6 }}><strong>{label}</strong><span className="chip">{books.filter((b) => b.status === status).length}</span></div>
      <div className="stack-sm">{books.filter((b) => b.status === status).map((b) => (
        <button key={b.id} className="card" style={{ padding: 10, textAlign: 'left', cursor: 'pointer' }} onClick={() => setEdit(b)}>
          <strong className="small serif" style={{ fontSize: '1.05rem' }}>{b.title}</strong><div className="xs muted">{b.author}</div>
          {status === 'reading' && b.pages ? <><Progress value={(b.currentPage || 0) / b.pages} color="var(--gold)" /><span className="xs muted">p. {b.currentPage || 0}/{b.pages}</span></> : null}
          {status === 'done' && b.rating ? <span className="xs" style={{ color: 'var(--gold)' }}>{'★'.repeat(b.rating)}</span> : null}
        </button>
      ))}</div>
    </div>
  );
  return (
    <div>
      <Title cat={cat} Icon={BookOpen}><button className="btn primary" onClick={() => setEdit({ status: 'to_read', quotes: [] })}><Plus size={15} />Livre</button></Title>
      <div className="grid g3 mb">
        <div className="card stat"><span className="stat-label">Livres terminés en {y}</span><span className="stat-value">{doneYear}{goal ? ` / ${goal}` : ''}</span>{goal ? <Progress value={doneYear / goal} color="var(--gold)" /> : null}</div>
        <div className="card"><Field label={`Objectif de lecture ${y} (livres)`}><input className="input" type="number" defaultValue={goal ?? ''} onBlur={(e) => store.put('settings', { id: 'main', readingGoalPerYear: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Objectif de lecture" /></Field></div>
        <div className="card stat"><span className="stat-label">Citations enregistrées</span><span className="stat-value">{books.reduce((a, b) => a + (b.quotes?.length || 0), 0)}</span></div>
      </div>
      <div className="kanban mb" style={{ gridAutoColumns: 'minmax(250px, 1fr)' }}>{col('to_read', 'À lire')}{col('reading', 'En cours')}{col('done', 'Terminés')}</div>
      <div className="grid g2">
        <ListBlock space="lecture-sujets" title="Sujets que je souhaite découvrir" placeholder="Ex. Psychologie de la motivation" />
        <ListBlock space="lecture-apprentissages" title="Mes apprentissages et réflexions" placeholder="Une idée à retenir" />
        <GoalsBlock categoryId="lecture" title="Objectifs de développement personnel" defaults={{ metric: 'livres' }} />
        <CategoryAgenda categoryId="lecture" title="Moments de lecture prévus" days={14} defaults={{ type: 'lecture' }} />
      </div>
      {edit && <BookModal b={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ---------------- Catégorie personnalisée ----------------
export function GenericSpace({ cat }) {
  return (
    <div>
      <Title cat={cat} Icon={Tag} />
      <div className="grid g2">
        <CategoryAgenda categoryId={cat.id} title="Activités" days={30} />
        <CategoryStats categoryId={cat.id} />
        <GoalsBlock categoryId={cat.id} title="Objectifs" />
        <ListBlock space={`cat-${cat.id}`} title="Liste" />
      </div>
    </div>
  );
}

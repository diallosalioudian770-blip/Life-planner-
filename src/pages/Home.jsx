import { Link } from 'react-router-dom';
import { ArrowRight, Plus, CalendarClock, Wallet, BookOpen, Target, Sun } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { rangeStats, financeStats, euro, goalProgress } from '../lib/stats.js';
import { addDays, today, startOfWeek, startOfMonth, endOfMonth, fmtShort, fmtHours, diffDays, monthKey, weekKey } from '../lib/date.js';
import { Ring, Progress, Empty, useCategories, useSettings, useCat } from '../components/ui.jsx';
import { ItemRow, openItemForm } from '../components/items.jsx';
import { SPACE_ICONS, LibraryArt } from '../components/icons.jsx';
import { TodayHabits } from './HabitsWidgets.jsx';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bel après-midi' : 'Bonsoir';
}

export default function Home() {
  useStore();
  const t = today();
  const settings = useSettings();
  const cats = useCategories();
  const cat = useCat();
  const todayOcc = occurrences(store, t, t);
  const tasks = todayOcc.filter((o) => o.isTask);
  const doneN = tasks.filter((o) => o.status === 'done').length;
  const prio = todayOcc.filter((o) => o.status !== 'done' && (o.priority === 'fixe' || o.priority === 'haute'));
  const next = todayOcc.filter((o) => o.start && o.status !== 'done');
  const wFrom = startOfWeek(t);
  const week = rangeStats(store, wFrom, addDays(wFrom, 6), t);
  const upcoming = occurrences(store, t, addDays(t, 21)).filter((o) => ['examen', 'interro', 'echeance', 'rdv'].includes(o.type) || o.important).slice(0, 8);
  const overdue = occurrences(store, addDays(t, -60), addDays(t, -1)).filter((o) => o.isTask && o.status !== 'done');
  const fin = financeStats(store, startOfMonth(t), endOfMonth(t));
  const budget = settings.finance?.monthlyBudget;
  const reading = store.list('books').filter((b) => b.status === 'reading');
  const goals = store.list('goals').filter((g) => !g.done && ((g.horizon === 'mois' && g.period === monthKey(t)) || (g.horizon === 'semaine' && g.period === weekKey(t)) || g.horizon === 'annee' || g.horizon === 'long')).slice(0, 5);
  const quotes = settings.quotes || [];
  const q = quotes.length ? quotes[diffDays('2026-01-01', t) % quotes.length] : null;
  const affirmations = settings.affirmations || [];
  const aff = affirmations.length ? affirmations[Math.abs(diffDays('2026-01-01', t)) % affirmations.length] : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="hero">
        <div style={{ maxWidth: 620, position: 'relative', zIndex: 1 }}>
          <div className="eyebrow">{settings.appName || 'Life Planner'}</div>
          <h1>{greeting()}.</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {tasks.length ? `${doneN} tâche${doneN > 1 ? 's' : ''} validée${doneN > 1 ? 's' : ''} sur ${tasks.length} aujourd'hui${prio.length ? `, dont ${prio.length} priorité${prio.length > 1 ? 's' : ''} encore à faire` : ''}.` : "Rien de prévu aujourd'hui pour l'instant."}
            {overdue.length ? ` ${overdue.length} tâche${overdue.length > 1 ? 's' : ''} des jours précédents t'attend${overdue.length > 1 ? 'ent' : ''}.` : ''}
          </p>
          {q && <p className="quote" style={{ marginTop: 14 }}>“{q.text}” <span className="xs muted" style={{ fontStyle: 'normal' }}>— {q.author}</span></p>}
          <div className="row wrap" style={{ marginTop: 16 }}>
            <Link className="btn primary" to="/jour"><Sun size={16} />Ma journée</Link>
            <button className="btn" onClick={() => openItemForm()}><Plus size={16} />Ajouter</button>
          </div>
        </div>
        <div className="hero-art"><LibraryArt size={220} /></div>
      </section>

      <div className="grid g3">
        <div className="card">
          <div className="card-head"><h3>Aujourd'hui</h3><Link to="/jour" className="small row" style={{ gap: 4 }}>Détail <ArrowRight size={14} /></Link></div>
          <div className="row" style={{ gap: 16 }}>
            <Ring value={tasks.length ? doneN / tasks.length : 0} />
            <div className="stack-sm small">
              <span><strong>{tasks.length - doneN}</strong> restante{tasks.length - doneN > 1 ? 's' : ''}</span>
              <span><strong>{fmtHours(rangeStats(store, t, t, t).totals.actualMin)}</strong> réellement effectuées</span>
              {next[0] && <span className="muted">Prochain : {next[0].start} · {next[0].title}</span>}
            </div>
          </div>
          <div className="list mt">
            {prio.slice(0, 4).map((o) => <ItemRow key={o.key} o={o} compact />)}
            {!prio.length && <p className="small muted mt">Aucune priorité en attente.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Cette semaine</h3><Link to="/semaine" className="small row" style={{ gap: 4 }}>Semaine <ArrowRight size={14} /></Link></div>
          <div className="stack-sm">
            <div className="row between small"><span>Tâches validées</span><strong>{week.totals.tasksDone} / {week.totals.tasks}</strong></div>
            <Progress value={week.totals.tasks ? week.totals.tasksDone / week.totals.tasks : 0} />
            <div className="row between small"><span>Heures prévues</span><span>{fmtHours(week.totals.plannedMin)}</span></div>
            <div className="row between small"><span>Heures effectuées</span><strong>{fmtHours(week.totals.actualMin)}</strong></div>
          </div>
          <Link className="btn sm mt" to="/semaine/bilan" style={{ marginTop: 14 }}>Bilan de la semaine</Link>
        </div>
        <div className="card">
          <div className="card-head"><h3><CalendarClock size={18} />À venir</h3><Link to="/mois" className="small">Calendrier</Link></div>
          {upcoming.length ? (
            <div className="list">
              {upcoming.map((o) => (
                <Link key={o.key} to={`/jour?d=${o.date}`} className="list-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="chip" style={{ minWidth: 62, justifyContent: 'center' }}>{o.date === t ? "Auj." : fmtShort(o.date)}</span>
                  <span className="ellipsis" style={{ flex: 1 }}>{o.title}</span>
                  <i className="dot" style={{ background: cat(o.categoryId).color }} />
                </Link>
              ))}
            </div>
          ) : <Empty>Pas d'examen, d'échéance ni de rendez-vous dans les 3 prochaines semaines.</Empty>}
        </div>
      </div>

      <div>
        <div className="row between mb" style={{ marginBottom: 10 }}><h2>Mes espaces</h2><Link to="/parametres#categories" className="small">Personnaliser</Link></div>
        <div className="grid g-auto">
          {cats.map((c) => {
            const Icon = SPACE_ICONS[c.space] || SPACE_ICONS.default;
            const x = week.byCat[c.id];
            return (
              <Link key={c.id} to={`/espace/${c.id}`} className="card space-card" style={{ padding: 14 }}>
                <div className="row"><span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}><Icon size={18} /></span><strong className="ellipsis">{c.name}</strong></div>
                <div className="xs muted">{x ? `${x.tasksDone}/${x.tasks} cette semaine · ${fmtHours(x.actualMin)}` : 'Rien de prévu cette semaine'}</div>
                <Progress value={x?.tasks ? x.tasksDone / x.tasks : 0} color={c.color} />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid g3">
        <div className="card">
          <div className="card-head"><h3><Target size={18} />Objectifs en cours</h3></div>
          {goals.length ? <div className="stack-sm">{goals.map((g) => (
            <div key={g.id}><div className="row between small"><span className="ellipsis">{g.title}</span><span className="muted">{Math.round(goalProgress(store, g, t) * 100)} %</span></div><Progress value={goalProgress(store, g, t)} color={cat(g.categoryId).color} /></div>
          ))}</div> : <Empty>Aucun objectif en cours. Crée-les depuis tes espaces, la semaine, le mois ou l'année.</Empty>}
          {aff && <p className="serif italic mt" style={{ fontSize: '1.1rem' }}>{aff}</p>}
        </div>
        <div className="card">
          <div className="card-head"><h3><Wallet size={18} />Budget du mois</h3><Link to="/espace/finances" className="small">Finances</Link></div>
          {fin.balance == null && !fin.count ? <Empty>Renseigne ton solde et tes opérations dans l'espace Finances.</Empty> : (
            <div className="stack-sm small">
              {fin.balance != null && <div className="row between"><span>Solde calculé</span><strong className="serif" style={{ fontSize: '1.4rem' }}>{euro(fin.balance)}</strong></div>}
              <div className="row between"><span>Dépensé ce mois</span><strong>{euro(fin.expense)}</strong></div>
              {budget ? <><Progress value={fin.expense / budget} color={fin.expense > budget ? 'var(--danger)' : 'var(--gold)'} /><span className="xs muted">Reste {euro(budget - fin.expense)} sur {euro(budget)}</span></> : <span className="xs muted">Pas de budget mensuel défini.</span>}
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3><BookOpen size={18} />En cours de lecture</h3></div>
            {reading.length ? reading.slice(0, 2).map((b) => (
              <div key={b.id} className="mb" style={{ marginBottom: 8 }}><div className="small"><strong>{b.title}</strong> {b.author && <span className="muted">· {b.author}</span>}</div>{b.pages ? <Progress value={(b.currentPage || 0) / b.pages} color="var(--gold)" /> : null}</div>
            )) : <Empty>Aucun livre en cours.</Empty>}
          </div>
        </div>
      </div>
      <TodayHabits date={t} />
    </div>
  );
}

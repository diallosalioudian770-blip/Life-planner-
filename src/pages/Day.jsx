import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, CalendarClock, CheckCircle2, Timer } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { rangeStats, postponedIn } from '../lib/stats.js';
import { PRIORITIES } from '../lib/defaults.js';
import { addDays, fmtDay, today, toMin, fromMin, fmtDuration, fmtShort } from '../lib/date.js';
import { PageHead, Ring, Empty, useCat, useSettings } from '../components/ui.jsx';
import { ItemRow, openItemForm, openTimeLog, toggleDone } from '../components/items.jsx';
import { TodayHabits, TodayRoutines } from './HabitsWidgets.jsx';

export function layoutLanes(items) {
  // assign overlapping timed items to side-by-side lanes
  const ev = items.map((o) => ({ o, s: toMin(o.start), e: toMin(o.start) + Math.max(o.durationMin || 30, 20) })).sort((a, b) => a.s - b.s);
  const groups = [];
  let cur = [];
  let end = -1;
  for (const x of ev) {
    if (x.s >= end && cur.length) { groups.push(cur); cur = []; }
    cur.push(x);
    end = Math.max(end, x.e);
  }
  if (cur.length) groups.push(cur);
  for (const g of groups) {
    const lanes = [];
    for (const x of g) {
      let i = lanes.findIndex((l) => l <= x.s);
      if (i < 0) { i = lanes.length; lanes.push(0); }
      lanes[i] = x.e;
      x.lane = i;
    }
    for (const x of g) x.lanes = lanes.length;
  }
  return ev;
}

export function Timeline({ items, date }) {
  const cat = useCat();
  const HOUR = 56;
  const timed = items.filter((o) => o.start);
  const startH = Math.min(8, ...timed.map((o) => Math.floor(toMin(o.start) / 60)));
  const endH = Math.max(22, ...timed.map((o) => Math.ceil((toMin(o.start) + (o.durationMin || 30)) / 60)));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const ev = layoutLanes(timed);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = date === today();
  return (
    <div className="timeline" style={{ height: (endH - startH) * HOUR + 10 }} aria-label="Planning horaire">
      {hours.map((h) => (
        <div key={h}>
          <div className="tl-hour" style={{ top: (h - startH) * HOUR }}>{String(h).padStart(2, '0')}:00</div>
          <div className="tl-line" style={{ top: (h - startH) * HOUR }} />
        </div>
      ))}
      {isToday && nowMin >= startH * 60 && nowMin <= endH * 60 && <div className="tl-now" style={{ top: ((nowMin - startH * 60) / 60) * HOUR }} />}
      {ev.map(({ o, s, e, lane, lanes }) => {
        const c = cat(o.categoryId);
        return (
          <div key={o.key} className={'tl-item' + (o.status === 'done' ? ' done' : '')} onClick={() => openItemForm({ occ: o })}
            style={{ top: ((s - startH * 60) / 60) * HOUR + 1, height: Math.max(24, ((e - s) / 60) * HOUR - 3), borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 14%, var(--surface))`, left: `calc(8px + ${(lane / lanes) * 100}% - ${(lane / lanes) * 12}px)`, width: `calc(${100 / lanes}% - ${12 / lanes + 4}px)`, right: 'auto' }}>
            <div className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={o.status === 'done'} onClick={(ev2) => ev2.stopPropagation()} onChange={() => toggleDone(o)} aria-label={`Valider ${o.title}`} />
              <strong className={'ellipsis' + (o.status === 'done' ? ' done-text' : '')}>{o.title}</strong>
            </div>
            <div className="xs muted">{o.start}–{fromMin(toMin(o.start) + (o.durationMin || 0))} · {c.name}</div>
          </div>
        );
      })}
      {!timed.length && <div style={{ position: 'absolute', top: 40, left: 16, right: 16 }}><Empty title="Aucun horaire fixé">Ajoute un cours, un rendez-vous ou une séance avec une heure pour la voir ici.</Empty></div>}
    </div>
  );
}

export default function Day() {
  const [params, setParams] = useSearchParams();
  const date = params.get('d') || today();
  const go = (d) => setParams(d === today() ? {} : { d });
  useStore();
  const settings = useSettings();
  const t = today();
  const items = occurrences(store, date, date);
  const st = rangeStats(store, date, date, t);
  const tasks = items.filter((o) => o.isTask);
  const done = items.filter((o) => o.status === 'done');
  const remaining = tasks.filter((o) => o.status !== 'done');
  const postponed = postponedIn(store, date, date);
  const overdue = date === t ? occurrences(store, addDays(t, -60), addDays(t, -1)).filter((o) => o.isTask && o.status !== 'done') : [];
  const progress = tasks.length ? tasks.filter((o) => o.status === 'done').length / tasks.length : 0;
  const quotes = settings.quotes || [];
  const q = quotes.length ? quotes[(new Date(date).getDate() + new Date(date).getMonth()) % quotes.length] : null;
  const nav = useNavigate();

  return (
    <div>
      <PageHead eyebrow="Journée" title={<span style={{ textTransform: 'capitalize' }}>{fmtDay(date)}</span>}>
        <button className="btn icon" aria-label="Jour précédent" onClick={() => go(addDays(date, -1))}><ChevronLeft size={18} /></button>
        <button className="btn" onClick={() => go(t)} disabled={date === t}>Aujourd'hui</button>
        <button className="btn icon" aria-label="Jour suivant" onClick={() => go(addDays(date, 1))}><ChevronRight size={18} /></button>
        <input className="input" type="date" style={{ width: 160 }} value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Choisir une date" />
        <button className="btn primary" onClick={() => openItemForm({ defaults: { date } })}><Plus size={16} />Ajouter</button>
      </PageHead>

      <div className="grid g4 mb" data-testid="day-summary">
        <div className="card row" style={{ gap: 14 }}>
          <Ring value={progress} size={64} />
          <div className="stat"><span className="stat-label">Progression</span><span className="small">{tasks.filter((o) => o.status === 'done').length} / {tasks.length} tâches</span></div>
        </div>
        <div className="card stat"><span className="stat-label">Tâches prévues</span><span className="stat-value">{tasks.length}</span><span className="xs muted">+ {items.length - tasks.length} cours / événements</span></div>
        <div className="card stat"><span className="stat-label">Restantes</span><span className="stat-value">{remaining.length}</span><span className="xs muted">{postponed.length ? `${postponed.length} reportée(s) depuis ce jour` : 'aucune reportée'}</span></div>
        <div className="card stat"><span className="stat-label">Temps réellement effectué</span><span className="stat-value">{fmtDuration(st.totals.actualMin)}</span><span className="xs muted">prévu : {fmtDuration(st.totals.plannedMin)}</span></div>
      </div>

      {overdue.length > 0 && (
        <div className="card mb" style={{ borderColor: 'var(--rose)' }}>
          <div className="card-head"><h3><CalendarClock size={18} />Encore à faire (jours précédents)</h3><span className="small muted">Elles ne disparaissent pas : reporte-les, modifie-les ou supprime-les.</span></div>
          <div className="list">{overdue.map((o) => <ItemRow key={o.key} o={o} showDate />)}</div>
        </div>
      )}

      <div className="grid day-cols">
        <div className="card">
          <div className="card-head"><h3><Clock size={18} />Planning horaire</h3></div>
          <Timeline items={items} date={date} />
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>Mes priorités</h3><button className="btn sm" onClick={() => openTimeLog({ date })}><Timer size={14} />Noter du temps</button></div>
            {items.filter((o) => o.status !== 'done').length === 0 && <Empty title={items.length ? 'Tout est validé' : 'Journée libre'}>{items.length ? 'Bravo pour ta journée.' : 'Rien de prévu. Ajoute une tâche ou profite de ce temps libre.'}</Empty>}
            {PRIORITIES.map((p) => {
              const list = items.filter((o) => o.priority === p.id && o.status !== 'done');
              if (!list.length) return null;
              return (
                <div key={p.id} className="mb" data-testid={`prio-${p.id}`}>
                  <div className="row xs" style={{ textTransform: 'uppercase', letterSpacing: '.1em', color: p.id === 'fixe' || p.id === 'haute' ? 'var(--primary)' : 'var(--muted)', fontWeight: 600 }}>{p.plural} <span className="muted">· {list.length}</span></div>
                  <div className="list">{list.map((o) => <ItemRow key={o.key} o={o} />)}</div>
                </div>
              );
            })}
          </div>
          <div className="card" data-testid="done-list">
            <div className="card-head"><h3><CheckCircle2 size={18} />Terminées</h3><span className="chip">{done.length}</span></div>
            {done.length ? <div className="list">{done.map((o) => <ItemRow key={o.key} o={o} />)}</div> : <p className="small muted">Coche une tâche quand elle est vraiment faite : seules les tâches validées comptent dans tes statistiques.</p>}
          </div>
          {postponed.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Reportées</h3></div>
              <div className="list">{postponed.map((p, i) => (
                <div key={i} className="list-row small"><span style={{ flex: 1 }}>{p.title}</span><button className="btn ghost sm" onClick={() => nav('/jour?d=' + p.to)}>→ {fmtShort(p.to)}</button></div>
              ))}</div>
            </div>
          )}
          <TodayRoutines date={date} />
          <TodayHabits date={date} />
          {q && <div className="card flat" style={{ background: 'transparent' }}><p className="quote">“{q.text}”</p><p className="xs muted" style={{ marginTop: 4 }}>— {q.author}</p></div>}
        </div>
      </div>
    </div>
  );
}

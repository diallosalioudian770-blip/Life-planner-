import { Link } from 'react-router-dom';
import { Minus, Plus, Sparkles, Repeat } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { habitDue, habitDone } from '../lib/stats.js';
import { parse } from '../lib/date.js';
import { Check2, Progress } from '../components/ui.jsx';

export function routineDue(r, date) {
  if (r.active === false) return false;
  if (r.frequency === 'once') return r.date === date;
  if (r.frequency === 'weekly') return (r.days || []).includes(parse(date).getDay());
  return true;
}

export function setHabit(h, date, value) {
  store.put('habitLogs', { id: `${h.id}@${date}`, habitId: h.id, date, value });
}

export function HabitToggle({ h, date }) {
  const log = useStore((s) => s.get('habitLogs', `${h.id}@${date}`));
  const done = habitDone(h, log);
  if (h.unit && h.target) {
    const v = Number(log?.value) || 0;
    return (
      <div className="row" style={{ gap: 4 }}>
        <button className="btn icon sm" aria-label={`Retirer 1 ${h.unit}`} onClick={() => setHabit(h, date, Math.max(0, v - 1))}><Minus size={14} /></button>
        <span className="small nowrap" style={{ minWidth: 64, textAlign: 'center', fontWeight: done ? 600 : 400, color: done ? 'var(--ok)' : undefined }}>{v} / {h.target} {h.unit}</span>
        <button className="btn icon sm" aria-label={`Ajouter 1 ${h.unit}`} onClick={() => setHabit(h, date, v + 1)}><Plus size={14} /></button>
      </div>
    );
  }
  return <Check2 on={done} onClick={() => setHabit(h, date, done ? 0 : 1)} label={h.name} />;
}

export function TodayHabits({ date }) {
  const habits = useStore((s) => s.list('habits')).filter((h) => !h.archived && habitDue(h, date));
  if (!habits.length) return null;
  return (
    <div className="card">
      <div className="card-head"><h3><Repeat size={18} />Habitudes du jour</h3><Link className="small" to="/espace/habitudes">Gérer</Link></div>
      <div className="list">
        {habits.map((h) => (
          <div key={h.id} className="list-row">
            <span style={{ flex: 1 }}>{h.name}{h.kind === 'reduce' && <span className="xs muted"> · à réduire</span>}</span>
            <HabitToggle h={h} date={date} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoutineCard({ r, date }) {
  const log = useStore((s) => s.get('routineLogs', `${r.id}@${date}`));
  const steps = r.steps || [];
  const doneSteps = log?.steps || {};
  const n = steps.filter((s) => doneSteps[s.id]).length;
  const toggle = (sid) => {
    const next = { ...doneSteps, [sid]: !doneSteps[sid] };
    store.put('routineLogs', { id: `${r.id}@${date}`, routineId: r.id, date, steps: next, done: steps.every((s) => next[s.id]) });
  };
  return (
    <div className="card flat" style={{ background: 'var(--surface-2)', padding: 12 }}>
      <div className="row between"><strong className="small">{r.name}</strong><span className="xs muted">{n}/{steps.length}</span></div>
      <Progress value={steps.length ? n / steps.length : 0} color="var(--rose)" />
      <div className="stack-sm" style={{ marginTop: 8 }}>
        {steps.map((s) => (
          <label key={s.id} className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={!!doneSteps[s.id]} onChange={() => toggle(s.id)} />
            <span className={doneSteps[s.id] ? 'done-text' : ''}>{s.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function TodayRoutines({ date }) {
  const routines = useStore((s) => s.list('routines')).filter((r) => routineDue(r, date));
  if (!routines.length) return null;
  return (
    <div className="card">
      <div className="card-head"><h3><Sparkles size={18} />Routines du jour</h3><Link className="small" to="/espace/beaute">Gérer</Link></div>
      <div className="grid g2">{routines.map((r) => <RoutineCard key={r.id} r={r} date={date} />)}</div>
    </div>
  );
}

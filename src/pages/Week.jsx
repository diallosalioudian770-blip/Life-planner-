import { useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, BarChart3, Wand2, Target } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { rangeStats, studyStats } from '../lib/stats.js';
import { addDays, startOfWeek, weekDays, today, toMin, fromMin, fmtShort, WEEKDAYS_SHORT, weekKey, fmtHours, parse } from '../lib/date.js';
import { PageHead, Progress, useCat, useCategories, Empty } from '../components/ui.jsx';
import { ItemRow, openItemForm, moveWithScope } from '../components/items.jsx';
import { GoalsBlock } from '../components/blocks.jsx';
import { layoutLanes } from './Day.jsx';
import { SuggestionsModal } from './Suggestions.jsx';

const HOUR = 46;

function WeekGrid({ days, occ }) {
  const cat = useCat();
  const t = today();
  const timed = occ.filter((o) => o.start);
  const startH = Math.min(8, ...timed.map((o) => Math.floor(toMin(o.start) / 60)));
  const endH = Math.max(22, ...timed.map((o) => Math.ceil((toMin(o.start) + (o.durationMin || 30)) / 60)));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);

  const onDown = (e, o) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDrag({ o, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) + Math.abs(dy) > 5 });
  };
  const target = (d) => {
    const rect = gridRef.current.getBoundingClientRect();
    const colW = (rect.width - 52) / 7;
    const origCol = days.indexOf(d.o.date);
    const col = Math.max(0, Math.min(6, origCol + Math.round(d.dx / colW)));
    const min = Math.max(0, Math.min(24 * 60 - 15, Math.round((toMin(d.o.start) + (d.dy / HOUR) * 60) / 15) * 15));
    return { date: days[col], start: fromMin(min), col };
  };
  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) { openItemForm({ occ: d.o }); return; }
    const tg = target(d);
    moveWithScope(d.o, tg.date, tg.start);
  };

  const dropDay = (e, date) => {
    e.preventDefault();
    setOver(null);
    const o = window.__dragOcc;
    if (o) moveWithScope(o, date, o.start);
    window.__dragOcc = null;
  };

  const ev = days.map((d) => layoutLanes(timed.filter((o) => o.date === d)));
  return (
    <div className="week-grid" ref={gridRef} data-testid="week-grid">
      <div />
      {days.map((d, i) => (
        <div key={d} className={'wg-head' + (d === t ? ' today' : '')}>
          <div className="xs muted">{WEEKDAYS_SHORT[i]}</div>
          <Link to={`/jour?d=${d}`} className="num" style={{ color: 'inherit', textDecoration: 'none' }}>{parse(d).getDate()}</Link>
        </div>
      ))}
      <div className="xs muted" style={{ padding: 4, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Sans heure</div>
      {days.map((d) => (
        <div key={d} className={'wg-allday' + (over === d ? ' drop-target' : '')} onDragOver={(e) => { e.preventDefault(); setOver(d); }} onDragLeave={() => setOver(null)} onDrop={(e) => dropDay(e, d)} onDoubleClick={() => openItemForm({ defaults: { date: d } })}>
          {occ.filter((o) => o.date === d && !o.start).map((o) => {
            const c = cat(o.categoryId);
            return (
              <div key={o.key} className={'mini-item' + (o.status === 'done' ? ' done-text' : '')} draggable onDragStart={() => { window.__dragOcc = o; }} onClick={() => openItemForm({ occ: o })} style={{ borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 12%, var(--surface))` }} title={o.title}>{o.title}</div>
            );
          })}
        </div>
      ))}
      <div className="wg-hours" style={{ height: hours.length * HOUR }}>
        {hours.map((h, i) => <div key={h} className="xs muted" style={{ position: 'absolute', top: i * HOUR - 7, right: 6 }}>{String(h).padStart(2, '0')}h</div>)}
      </div>
      {days.map((d, ci) => (
        <div key={d} className="wg-col" style={{ height: hours.length * HOUR }} onPointerMove={onMove} onPointerUp={onUp}
          onDoubleClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const m = Math.round(((e.clientY - r.top) / HOUR * 60 + startH * 60) / 30) * 30; openItemForm({ defaults: { date: d, start: fromMin(m), durationMin: 60 } }); }}>
          {hours.map((h, i) => <div key={h} className="tl-line" style={{ top: i * HOUR }} />)}
          {ev[ci].map(({ o, s, e, lane, lanes }) => {
            const c = cat(o.categoryId);
            const dragging = drag?.o.key === o.key && drag.moved;
            const style = {
              top: ((s - startH * 60) / 60) * HOUR, height: Math.max(20, ((e - s) / 60) * HOUR - 2),
              borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 16%, var(--surface))`,
              left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, right: 'auto',
              transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
            };
            return (
              <div key={o.key} className={'wg-block' + (dragging ? ' dragging' : '') + (o.status === 'done' ? ' done' : '')} style={style}
                onPointerDown={(ev2) => onDown(ev2, o)} onPointerMove={onMove} onPointerUp={onUp} data-testid="week-block" title={`${o.title} — glisser pour déplacer`}>
                <strong className={o.status === 'done' ? 'done-text' : ''}>{o.title}</strong>
                <div className="muted">{dragging ? `${fmtShort(target(drag).date)} ${target(drag).start}` : o.start}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekList({ days, occ }) {
  return (
    <div className="stack">
      {days.map((d, i) => {
        const list = occ.filter((o) => o.date === d);
        return (
          <div key={d} className="card" style={{ padding: 14 }}>
            <div className="row between mb" style={{ marginBottom: 4 }}>
              <Link to={`/jour?d=${d}`} style={{ color: 'inherit', textDecoration: 'none' }}><strong className={d === today() ? '' : ''} style={d === today() ? { color: 'var(--primary)' } : null}>{WEEKDAYS_SHORT[i]} {fmtShort(d)}</strong></Link>
              <button className="btn ghost icon sm" aria-label={`Ajouter le ${fmtShort(d)}`} onClick={() => openItemForm({ defaults: { date: d } })}><Plus size={16} /></button>
            </div>
            {list.length ? <div className="list">{list.map((o) => <ItemRow key={o.key} o={o} />)}</div> : <p className="xs muted">Rien de prévu.</p>}
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyTargets({ from, to }) {
  useStore();
  const cats = useCategories();
  const t = today();
  const st = rangeStats(store, from, to, t);
  const study = studyStats(store, from, to);
  const subjects = store.list('subjects').filter((s) => s.weeklyGoalMin || study[s.id]?.plannedMin);
  const active = cats.filter((c) => st.byCat[c.id]);
  return (
    <div className="card">
      <div className="card-head"><h3><Target size={18} />Objectifs de la semaine par catégorie</h3></div>
      {subjects.length > 0 && (
        <div className="mb">
          <div className="xs muted mb" style={{ textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Révisions par matière (réalisé / objectif)</div>
          <div className="stack-sm">
            {subjects.map((s) => {
              const goal = s.weeklyGoalMin || study[s.id].plannedMin;
              return (
                <div key={s.id}>
                  <div className="row between small"><span>{s.name}</span><span className="muted">{fmtHours(study[s.id]?.actualMin)} / {fmtHours(goal)}</span></div>
                  <Progress value={goal ? (study[s.id]?.actualMin || 0) / goal : 0} color={s.color} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      {active.length ? (
        <div className="stack-sm">
          {active.map((c) => {
            const x = st.byCat[c.id];
            return (
              <div key={c.id}>
                <div className="row between small"><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: c.color }} />{c.name}</span><span className="muted">{x.tasksDone}/{x.tasks} tâches · {fmtHours(x.actualMin)} réalisées</span></div>
                <Progress value={x.tasks ? x.tasksDone / x.tasks : 0} color={c.color} />
              </div>
            );
          })}
        </div>
      ) : <Empty>Aucune activité cette semaine.</Empty>}
    </div>
  );
}

export default function Week() {
  const [params, setParams] = useSearchParams();
  const ref = params.get('w') || today();
  const from = startOfWeek(ref);
  const to = addDays(from, 6);
  const days = weekDays(from);
  useStore();
  const occ = occurrences(store, from, to);
  const [sugg, setSugg] = useState(false);
  const go = (d) => setParams(startOfWeek(d) === startOfWeek(today()) ? {} : { w: d });
  const wk = weekKey(from);
  return (
    <div>
      <PageHead eyebrow={`Semaine ${wk.split('-W')[1]}`} title={`Du ${fmtShort(from)} au ${fmtShort(to)}`}>
        <button className="btn icon" aria-label="Semaine précédente" onClick={() => go(addDays(from, -7))}><ChevronLeft size={18} /></button>
        <button className="btn" onClick={() => go(today())}>Cette semaine</button>
        <button className="btn icon" aria-label="Semaine suivante" onClick={() => go(addDays(from, 7))}><ChevronRight size={18} /></button>
        <button className="btn" onClick={() => setSugg(true)}><Wand2 size={16} />Proposer mes révisions</button>
        <Link className="btn primary" to={`/semaine/bilan?w=${from}`}><BarChart3 size={16} />Bilan de la semaine</Link>
      </PageHead>
      <p className="small muted mb hide-mobile">Glisse un bloc pour changer son jour ou son horaire, double-clique sur un créneau vide pour ajouter une activité.</p>
      <div className="hide-mobile"><WeekGrid days={days} occ={occ} /></div>
      <div className="show-mobile"><WeekList days={days} occ={occ} /></div>
      <div className="grid g2 mt-lg">
        <WeeklyTargets from={from} to={to} />
        <GoalsBlock horizon="semaine" period={wk} title="Mes objectifs de la semaine" defaults={{ refDate: from }} />
      </div>
      {sugg && <SuggestionsModal weekDate={from} onClose={() => setSugg(false)} />}
    </div>
  );
}

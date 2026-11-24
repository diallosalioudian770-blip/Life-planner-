import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, BarChart3 } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { occurrences } from '../lib/recurrence.js';
import { studyStats, sportStats, habitStats, booksFinished } from '../lib/stats.js';
import { addMonths, monthGrid, startOfMonth, endOfMonth, today, fmtMonth, fmtDay, monthKey, parse, WEEKDAYS_SHORT, fmtHours } from '../lib/date.js';
import { PageHead, Empty, useCat } from '../components/ui.jsx';
import { ItemRow, openItemForm, moveWithScope } from '../components/items.jsx';
import { GoalsBlock } from '../components/blocks.jsx';

export function MonthIndicators({ from, to }) {
  useStore();
  const t = today();
  const study = studyStats(store, from, to);
  const sp = sportStats(store, from, to, t);
  const hb = habitStats(store, from, to > t ? t : to);
  const books = booksFinished(store, from, to);
  const goals = store.list('goals').filter((g) => g.done && g.doneDate && g.doneDate >= from && g.doneDate <= to);
  const studyMin = Object.values(study).reduce((s, x) => s + x.actualMin, 0);
  const items = [
    ['Heures de révision', fmtHours(studyMin)],
    ['Séances sportives', `${sp.done}${sp.planned ? ' / ' + sp.planned : ''}`],
    ['Habitudes réalisées', hb.due ? `${hb.done} / ${hb.due}` : '—'],
    ['Livres terminés', books.length],
    ['Objectifs accomplis', goals.length],
  ];
  return (
    <div className="grid g-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }} data-testid="month-indicators">
      {items.map(([l, v]) => <div key={l} className="card stat" style={{ padding: 14 }}><span className="stat-label">{l}</span><span className="stat-value" style={{ fontSize: '1.6rem' }}>{v}</span></div>)}
    </div>
  );
}

export default function Month() {
  const [params, setParams] = useSearchParams();
  const ref = params.get('m') ? params.get('m') + '-01' : today();
  const from = startOfMonth(ref);
  const to = endOfMonth(ref);
  const grid = monthGrid(ref);
  const [sel, setSel] = useState(null);
  const [over, setOver] = useState(null);
  useStore();
  const cat = useCat();
  const occ = occurrences(store, grid[0], grid[41]);
  const t = today();
  const go = (d) => { setSel(null); setParams(monthKey(d) === monthKey(t) ? {} : { m: monthKey(d) }); };
  const selected = sel || (monthKey(t) === monthKey(from) ? t : from);
  const selItems = occ.filter((o) => o.date === selected);
  const drop = (e, d) => { e.preventDefault(); setOver(null); const o = window.__dragOcc; window.__dragOcc = null; if (o) moveWithScope(o, d, o.start); };

  return (
    <div>
      <PageHead eyebrow="Mois" title={<span style={{ textTransform: 'capitalize' }}>{fmtMonth(from)}</span>}>
        <button className="btn icon" aria-label="Mois précédent" onClick={() => go(addMonths(from, -1))}><ChevronLeft size={18} /></button>
        <button className="btn" onClick={() => go(t)}>Ce mois-ci</button>
        <button className="btn icon" aria-label="Mois suivant" onClick={() => go(addMonths(from, 1))}><ChevronRight size={18} /></button>
        <Link className="btn primary" to={`/bilan?m=${monthKey(from)}`}><BarChart3 size={16} />Bilan du mois</Link>
      </PageHead>
      <div className="grid cols-2-1">
        <div>
          <div className="month-grid" data-testid="month-grid">
            {WEEKDAYS_SHORT.map((w) => <div key={w} className="mg-head">{w}</div>)}
            {grid.map((d) => {
              const list = occ.filter((o) => o.date === d);
              const deadline = list.some((o) => ['examen', 'interro', 'echeance'].includes(o.type));
              return (
                <div key={d} className={'mg-cell' + (d.slice(0, 7) !== from.slice(0, 7) ? ' out' : '') + (d === t ? ' today' : '') + (d === selected ? ' selected' : '') + (over === d ? ' drop-target' : '')}
                  onClick={() => setSel(d)} onDoubleClick={() => openItemForm({ defaults: { date: d } })}
                  onDragOver={(e) => { e.preventDefault(); setOver(d); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, d)} data-date={d}>
                  <div className="row between"><span className="mg-num">{parse(d).getDate()}</span>{deadline && <span className="chip prio-haute xs" style={{ padding: '0 6px' }} title="Échéance ou examen">!</span>}</div>
                  {list.slice(0, 3).map((o) => {
                    const c = cat(o.categoryId);
                    return <div key={o.key} className={'mini-item' + (o.status === 'done' ? ' done-text' : '')} draggable onDragStart={() => { window.__dragOcc = o; }} style={{ borderLeftColor: c.color, background: `color-mix(in srgb, ${c.color} 12%, var(--surface))` }} title={o.title}>{o.start ? o.start + ' ' : ''}{o.title}</div>;
                  })}
                  {list.length > 3 && <span className="xs muted">+{list.length - 3}</span>}
                  <div className="mg-dots">{list.slice(0, 6).map((o) => <i key={o.key} className="dot" style={{ background: cat(o.categoryId).color }} />)}</div>
                </div>
              );
            })}
          </div>
          <p className="xs muted mt hide-mobile">Glisse une activité vers un autre jour pour la déplacer. Double-clic sur un jour pour ajouter.</p>
          <div className="mt"><MonthIndicators from={from} to={to} /></div>
        </div>
        <div className="stack">
          <div className="card" data-testid="day-detail">
            <div className="card-head">
              <h3 style={{ textTransform: 'capitalize' }}>{fmtDay(selected)}</h3>
              <div className="row" style={{ gap: 4 }}>
                <Link className="btn sm" to={`/jour?d=${selected}`}>Ouvrir</Link>
                <button className="btn sm primary" onClick={() => openItemForm({ defaults: { date: selected } })}><Plus size={14} />Ajouter</button>
              </div>
            </div>
            {selItems.length ? <div className="list">{selItems.map((o) => <ItemRow key={o.key} o={o} />)}</div> : <Empty>Rien de prévu ce jour-là.</Empty>}
          </div>
          <GoalsBlock horizon="mois" period={monthKey(from)} title="Objectifs du mois" defaults={{ refDate: from }} />
        </div>
      </div>
    </div>
  );
}

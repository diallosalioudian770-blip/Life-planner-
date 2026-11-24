import { useState } from 'react';
import { Check, X, Wand2 } from 'lucide-react';
import { store, useStore } from '../lib/store.js';
import { suggestRevisions } from '../lib/suggest.js';
import { createItem } from '../lib/recurrence.js';
import { fmtDay, fmtDuration, today } from '../lib/date.js';
import { Modal, Empty, toast } from '../components/ui.jsx';

export function SuggestionsModal({ weekDate, onClose }) {
  useStore();
  const [refused, setRefused] = useState([]);
  const [edits, setEdits] = useState({});
  const { suggestions, notes } = suggestRevisions(store, weekDate, today(), { refused });
  const subjects = store.list('subjects');
  const val = (s) => ({ ...s, ...(edits[s.id] || {}) });
  const accept = (s) => {
    const v = val(s);
    createItem(store, { title: v.title, type: 'revision', categoryId: 'etudes', subjectId: v.subjectId, date: v.date, start: v.start, durationMin: Number(v.durationMin) || 60, priority: 'haute', fromSuggestion: true });
    toast('Séance ajoutée à ton planning.');
  };
  const edit = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), [k]: v } }));
  return (
    <Modal wide title={<span className="row"><Wand2 size={18} />Propositions de révision</span>} onClose={onClose} footer={<>
      <span className="small muted" style={{ flex: 1 }}>Rien n'est ajouté sans ton accord.</span>
      {suggestions.length > 1 && <button className="btn" onClick={() => { suggestions.forEach(accept); }}>Tout accepter</button>}
      <button className="btn primary" onClick={onClose}>Terminer</button>
    </>}>
      <p className="small muted mb">Les séances sont placées dans tes disponibilités (Paramètres › Planification), autour de tes cours et activités existantes, avec des pauses, sans dépasser ta limite d'étude par jour et en gardant du temps libre pour les imprévus. Les matières alternent et les examens proches passent en premier.</p>
      {notes.map((n, i) => <div key={i} className="banner mb">{n}</div>)}
      {suggestions.length === 0 && !notes.length && <Empty title="Rien à proposer">Ton planning de révision couvre déjà tes objectifs de la semaine.</Empty>}
      <div className="list">
        {suggestions.map((s) => {
          const v = val(s);
          const subj = subjects.find((x) => x.id === s.subjectId);
          return (
            <div key={s.id} className="list-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="suggestion">
              <span className="dot" style={{ background: subj?.color, marginTop: 8 }} />
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{subj?.name}</div>
                <div className="xs muted">{s.reason}</div>
                <div className="xs muted" style={{ textTransform: 'capitalize' }}>{fmtDay(v.date)} · {v.start} · {fmtDuration(v.durationMin)}</div>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <input className="input" type="date" style={{ width: 150 }} value={v.date} onChange={(e) => edit(s.id, 'date', e.target.value)} aria-label="Date proposée" />
                <input className="input" type="time" style={{ width: 110 }} value={v.start} onChange={(e) => edit(s.id, 'start', e.target.value)} aria-label="Heure proposée" />
                <input className="input" type="number" step="15" style={{ width: 80 }} value={v.durationMin} onChange={(e) => edit(s.id, 'durationMin', e.target.value)} aria-label="Durée proposée" />
                <button className="btn primary sm" onClick={() => accept(s)}><Check size={14} />Accepter</button>
                <button className="btn sm" onClick={() => setRefused((r) => [...r, s.id])}><X size={14} />Refuser</button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

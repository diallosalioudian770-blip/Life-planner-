import { useEffect, useState, useSyncExternalStore } from 'react';
import { X, Check } from 'lucide-react';
import { useStore } from '../lib/store.js';

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// `group`: for fields holding several buttons (a <label> would forward clicks to the first one)
export const Field = ({ label, children, full, hint, group }) => {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={'field' + (full ? ' full' : '')} role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span>{label}</span>
      {children}
      {hint && <small className="muted xs">{hint}</small>}
    </Tag>
  );
};

export function Progress({ value, color, label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, size = 76, stroke = 7, color = 'var(--primary)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: size > 70 ? '1rem' : '.8rem' }}>{children ?? `${Math.round(v * 100)} %`}</div>
    </div>
  );
}

export const Empty = ({ title, children }) => (
  <div className="empty">{title && <span className="serif">{title}</span>}{children}</div>
);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={'tab' + (value === id ? ' active' : '')} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

export const Check2 = ({ on, onClick, label }) => (
  <button type="button" className={'check' + (on ? ' on' : '')} onClick={onClick} aria-pressed={!!on} aria-label={label}>
    {on && <Check size={15} strokeWidth={3} />}
  </button>
);

export const Ornament = () => <div className="ornament" aria-hidden="true"><span>◆</span></div>;

export function PageHead({ eyebrow, title, children, sub }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="muted mt" style={{ marginTop: 6 }}>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function useSettings() {
  return useStore((s) => s.get('settings', 'main')) || {};
}
export function useCategories() {
  const st = useSettings();
  return [...(st.categories || [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}
export function useCat() {
  const cats = useCategories();
  return (id) => cats.find((c) => c.id === id) || { id: 'autre', name: 'Autre', color: '#8A7E86' };
}

export function CatChip({ cat }) {
  return <span className="chip"><span className="dot" style={{ background: cat.color }} />{cat.name}</span>;
}

// ---- tiny global UI bus (dialogs, toasts) ----
let ui = { dialog: null, toast: null };
const uiListeners = new Set();
const setUI = (p) => { ui = { ...ui, ...p }; uiListeners.forEach((l) => l()); };
export const useUI = () => useSyncExternalStore((l) => { uiListeners.add(l); return () => uiListeners.delete(l); }, () => ui);
export const openDialog = (dialog) => setUI({ dialog });
export const closeDialog = () => setUI({ dialog: null });
let toastTimer;
export function toast(msg) {
  clearTimeout(toastTimer);
  setUI({ toast: msg });
  toastTimer = setTimeout(() => setUI({ toast: null }), 2600);
}

export function confirmDialog({ title, message, confirm = 'Confirmer', danger }) {
  return new Promise((resolve) => {
    openDialog({ type: 'confirm', title, message, confirm, danger, resolve });
  });
}
// recurring scope chooser: resolves 'this' | 'future' | 'all' | null
export function scopeDialog(action = 'modifier') {
  return new Promise((resolve) => openDialog({ type: 'scope', action, resolve }));
}

export function ConfirmView({ d }) {
  const done = (v) => { closeDialog(); d.resolve(v); };
  if (d.type === 'scope') {
    return (
      <Modal title={`${d.action === 'supprimer' ? 'Supprimer' : d.action === 'déplacer' ? 'Déplacer' : 'Modifier'} une activité récurrente`} onClose={() => done(null)}>
        <p className="muted mb">Cette activité se répète. Que veux-tu {d.action} ?</p>
        <div className="stack-sm">
          <button className="btn" onClick={() => done('this')}>Uniquement cette occurrence</button>
          {d.action !== 'déplacer' && <button className="btn" onClick={() => done('future')}>Cette occurrence et toutes les suivantes</button>}
          {d.action !== 'déplacer' && <button className="btn" onClick={() => done('all')}>Toute la série</button>}
          <button className="btn ghost" onClick={() => done(null)}>Annuler</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={d.title} onClose={() => done(false)} footer={<>
      <button className="btn ghost" onClick={() => done(false)}>Annuler</button>
      <button className={'btn primary'} onClick={() => done(true)}>{d.confirm}</button>
    </>}>
      <p>{d.message}</p>
    </Modal>
  );
}

export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem('lp:ui:' + key); return s != null ? JSON.parse(s) : initial; } catch { return initial; }
  });
  const set = (nv) => {
    setV((old) => {
      const val = typeof nv === 'function' ? nv(old) : nv;
      try { localStorage.setItem('lp:ui:' + key, JSON.stringify(val)); } catch { /* ignore */ }
      return val;
    });
  };
  return [v, set];
}

export function NumberInput({ value, onChange, ...p }) {
  return <input className="input" type="number" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} {...p} />;
}

import { useEffect, useState } from 'react';
import { Timer, Square } from 'lucide-react';
import { openTimeLog } from './items.jsx';
import { today } from '../lib/date.js';

// Study stopwatch. Its running state is kept on this device only; when stopped,
// the measured time is proposed as a real-time entry the user confirms.
const KEY = 'lp:timer';
export function StudyTimer() {
  const [t, setT] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } });
  const [, tick] = useState(0);
  useEffect(() => { if (!t) return; const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, [t]);
  const start = () => { const v = { startedAt: Date.now() }; localStorage.setItem(KEY, JSON.stringify(v)); setT(v); };
  const stop = () => {
    const min = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    localStorage.removeItem(KEY); setT(null);
    openTimeLog({ minutes: min, date: today(), categoryId: 'etudes' });
  };
  if (!t) return <button className="btn ghost sm" onClick={start} title="Lancer le chronomètre d'étude"><Timer size={16} /><span className="hide-mobile">Chrono</span></button>;
  const s = Math.floor((Date.now() - t.startedAt) / 1000);
  const fmt = `${String(Math.floor(s / 3600)).padStart(1, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return <button className="btn sm" onClick={stop} title="Arrêter et enregistrer le temps"><Square size={13} fill="currentColor" />{fmt}</button>;
}

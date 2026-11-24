import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Sun, CalendarDays, CalendarRange, Calendar, Settings as Gear, Plus, Bell, Menu, Cloud, CloudOff, RefreshCw, AlertTriangle, HardDrive, X } from 'lucide-react';
import { useStore, store } from './lib/store.js';
import { useSession, syncNow } from './lib/session.js';
import { computeReminders } from './lib/notify.js';
import { useUI, useSettings, useCategories, ConfirmView } from './components/ui.jsx';
import { ItemForm, CheckDialog, PostponeDialog, TimeLogDialog, openItemForm } from './components/items.jsx';
import { GoalForm } from './components/blocks.jsx';
import { SPACE_ICONS } from './components/icons.jsx';
import { StudyTimer } from './components/timer.jsx';
import Home from './pages/Home.jsx';
import Day from './pages/Day.jsx';
import Week from './pages/Week.jsx';
import WeekReview from './pages/WeekReview.jsx';
import Month from './pages/Month.jsx';
import Year from './pages/Year.jsx';
import Review from './pages/Review.jsx';
import Space from './pages/Space.jsx';
import Settings from './pages/Settings.jsx';
import Auth from './pages/Auth.jsx';
import { fmtDay, today } from './lib/date.js';

function useTheme() {
  const settings = useSettings();
  const pref = settings.theme || 'auto';
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'auto' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1525' : '#F5EEE3');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
  useEffect(() => { document.title = settings.appName || 'Life Planner'; }, [settings.appName]);
}

function SyncPill() {
  const s = useSession();
  const pending = useStore((st) => st.pendingCount());
  const nav = useNavigate();
  if (!s.user) {
    return <button className="sync-pill" onClick={() => nav('/parametres#compte')} title="Données enregistrées uniquement sur cet appareil"><HardDrive size={13} />Sur cet appareil</button>;
  }
  const st = s.sync?.state;
  const map = {
    ok: [<Cloud size={13} key="i" />, 'Synchronisé', 'ok'],
    syncing: [<RefreshCw size={13} key="i" className="spin" />, 'Synchronisation…', ''],
    pending: [<RefreshCw size={13} key="i" />, `${pending} en attente`, ''],
    offline: [<CloudOff size={13} key="i" />, `Hors ligne${pending ? ` · ${pending} en attente` : ''}`, ''],
    error: [<AlertTriangle size={13} key="i" />, 'Erreur de synchro', 'error'],
  };
  const [icon, label, cls] = map[st] || [<Cloud size={13} key="i" />, pending ? `${pending} en attente` : 'Synchronisé', ''];
  return <button className={'sync-pill ' + cls} onClick={() => syncNow()} title={s.sync?.error ? `${s.sync.error} — touche pour réessayer` : 'Toucher pour synchroniser maintenant'}>{icon}{label}</button>;
}

function Reminders({ onClose }) {
  useStore();
  const list = computeReminders(store).filter((r) => r.when.getTime() < Date.now() + 3 * 86400000);
  const nav = useNavigate();
  return (
    <div className="drawer" role="dialog" aria-label="Rappels">
      <div className="modal-head"><h3>Rappels</h3><button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={18} /></button></div>
      <div className="modal-body" style={{ overflowY: 'auto' }}>
        {list.length ? list.map((r) => (
          <div key={r.key} className="list-row" style={{ cursor: 'pointer' }} onClick={() => { nav('/jour?d=' + r.date); onClose(); }}>
            <Bell size={16} className="muted" />
            <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{r.title}</div><div className="small muted">{r.body}</div></div>
            <span className="xs muted nowrap">{r.when.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )) : <p className="muted small">Aucun rappel dans les 3 prochains jours. Les rappels se règlent sur chaque activité et dans Paramètres › Notifications.</p>}
      </div>
    </div>
  );
}

function DialogHost() {
  const { dialog, toast } = useUI();
  return (
    <>
      {dialog?.type === 'item' && <ItemForm d={dialog} key={dialog.occ?.key || 'new'} />}
      {dialog?.type === 'check' && <CheckDialog d={dialog} />}
      {dialog?.type === 'postpone' && <PostponeDialog d={dialog} />}
      {dialog?.type === 'timelog' && <TimeLogDialog d={dialog} />}
      {dialog?.type === 'goal' && <GoalForm d={dialog} />}
      {(dialog?.type === 'confirm' || dialog?.type === 'scope') && <ConfirmView d={dialog} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

const VIEWS = [
  ['/', 'Accueil', HomeIcon],
  ['/jour', 'Journée', Sun],
  ['/semaine', 'Semaine', CalendarRange],
  ['/mois', 'Mois', CalendarDays],
  ['/annee', 'Année', Calendar],
];

function Sidebar() {
  const cats = useCategories();
  const settings = useSettings();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">{(settings.appName || 'L')[0]}</div>
        <div><div className="brand-name">{settings.appName || 'Life Planner'}</div><div className="brand-sub">Planner personnel</div></div>
      </div>
      <nav>
        {VIEWS.map(([to, label, Icon]) => <NavLink key={to} to={to} end className="nav-link"><Icon size={17} />{label}</NavLink>)}
        <div className="nav-group">
          <div className="nav-label">Mes espaces</div>
          {cats.map((c) => {
            const Icon = SPACE_ICONS[c.space] || SPACE_ICONS.default;
            return <NavLink key={c.id} to={`/espace/${c.id}`} className="nav-link"><Icon size={16} style={{ color: c.color }} /><span className="ellipsis">{c.name}</span></NavLink>;
          })}
        </div>
        <div className="nav-group">
          <NavLink to="/bilan" className="nav-link"><CalendarDays size={17} />Bilans</NavLink>
          <NavLink to="/parametres" className="nav-link"><Gear size={17} />Paramètres</NavLink>
        </div>
      </nav>
    </aside>
  );
}

function MoreSheet({ onClose }) {
  const cats = useCategories();
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal more-sheet">
        <div className="modal-head"><h3>Mon planner</h3><button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer"><X size={18} /></button></div>
        <div className="modal-body" onClick={(e) => e.target.closest('a') && onClose()}>
          <NavLink to="/annee"><Calendar size={18} />Année</NavLink>
          <NavLink to="/bilan"><CalendarDays size={18} />Bilans</NavLink>
          <div className="nav-label" style={{ marginTop: 8 }}>Mes espaces</div>
          {cats.map((c) => { const Icon = SPACE_ICONS[c.space] || SPACE_ICONS.default; return <NavLink key={c.id} to={`/espace/${c.id}`}><Icon size={18} style={{ color: c.color }} />{c.name}</NavLink>; })}
          <NavLink to="/parametres"><Gear size={18} />Paramètres</NavLink>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  useTheme();
  const [bell, setBell] = useState(false);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); setMore(false); }, [loc.pathname]);
  const dueCount = useStore(() => computeReminders(store).filter((r) => r.when.getTime() <= Date.now() && r.when.getTime() > Date.now() - 86400000).length);
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <span className="muted small nowrap" style={{ textTransform: 'capitalize' }}>{fmtDay(today())}</span>
          <span className="grow" />
          <StudyTimer />
          <SyncPill />
          <button className="btn ghost icon" aria-label="Rappels" onClick={() => setBell(true)} style={{ position: 'relative' }}>
            <Bell size={18} />{dueCount > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: 'var(--primary)' }} />}
          </button>
          <button className="btn primary sm hide-mobile" onClick={() => openItemForm()}><Plus size={15} />Ajouter</button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/jour" element={<Day />} />
            <Route path="/semaine" element={<Week />} />
            <Route path="/semaine/bilan" element={<WeekReview />} />
            <Route path="/mois" element={<Month />} />
            <Route path="/annee" element={<Year />} />
            <Route path="/bilan" element={<Review />} />
            <Route path="/espace/:id" element={<Space />} />
            <Route path="/parametres" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navigation principale">
        {VIEWS.slice(0, 4).map(([to, label, Icon]) => <NavLink key={to} to={to} end><Icon size={21} />{label}</NavLink>)}
        <button onClick={() => setMore(true)}><Menu size={21} />Plus</button>
      </nav>
      <button className="fab" aria-label="Ajouter une activité" onClick={() => openItemForm()}><Plus size={26} /></button>
      {bell && <Reminders onClose={() => setBell(false)} />}
      {more && <MoreSheet onClose={() => setMore(false)} />}
      <DialogHost />
    </div>
  );
}

export default function App() {
  const s = useSession();
  useTheme();
  if (!s.ready) return null;
  if (s.configured && !s.user && s.mode !== 'local') return <><Auth /><DialogHost /></>;
  return <HashRouter><Shell /></HashRouter>;
}

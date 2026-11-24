import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Download, Upload, Bell, Cloud, LogOut, RefreshCw, X } from 'lucide-react';
import { store, useStore, uid } from '../lib/store.js';
import { useSession, syncNow, signOut, updatePassword } from '../lib/session.js';
import { getSupabaseConfig, saveSupabaseConfig } from '../lib/sync.js';
import { WEEKDAYS_LONG } from '../lib/date.js';
import { PageHead, Field, useSettings, useCategories, toast, confirmDialog, Modal } from '../components/ui.jsx';

const Section = ({ id, title, children, sub }) => (
  <section className="card" id={id}>
    <div className="card-head"><h3>{title}</h3></div>
    {sub && <p className="small muted mb">{sub}</p>}
    {children}
  </section>
);

function Categories() {
  const cats = useCategories();
  const settings = useSettings();
  const [name, setName] = useState('');
  const [del, setDel] = useState(null);
  const [target, setTarget] = useState('');
  const save = (categories) => store.put('settings', { id: 'main', categories: categories.map((c, i) => ({ ...c, rank: i + 1 })) });
  const move = (i, d) => { const a = [...cats]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); save(a); };
  const remove = () => {
    const rest = cats.filter((c) => c.id !== del.id);
    if (target) {
      const entries = store.list('items').filter((it) => it.categoryId === del.id).map((it) => ['items', { id: it.id, categoryId: target }]);
      for (const g of store.list('goals').filter((g) => g.categoryId === del.id)) entries.push(['goals', { id: g.id, categoryId: target }]);
      if (entries.length) store.putMany(entries);
    }
    save(rest);
    setDel(null);
    toast('Catégorie supprimée.');
  };
  return (
    <Section id="categories" title="Catégories et priorités" sub="L'ordre définit tes priorités (affichage, navigation, accueil). Chaque catégorie a son espace.">
      <div className="list">
        {cats.map((c, i) => (
          <div key={c.id} className="list-row">
            <input type="color" className="color-input" value={c.color} onChange={(e) => save(cats.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)))} aria-label={`Couleur ${c.name}`} />
            <span className="xs muted" style={{ width: 18 }}>{i + 1}</span>
            <input className="input" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && save(cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value.trim() } : x)))} aria-label="Nom de la catégorie" />
            <button className="btn ghost icon sm" disabled={i === 0} aria-label="Monter" onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
            <button className="btn ghost icon sm" disabled={i === cats.length - 1} aria-label="Descendre" onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
            <button className="btn ghost icon sm" aria-label={`Supprimer ${c.name}`} onClick={() => { setDel(c); setTarget(cats.find((x) => x.id !== c.id)?.id || ''); }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <form className="row mt" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; save([...cats, { id: uid('cat'), name: name.trim(), color: '#8C6A4F', space: 'custom' }]); setName(''); }}>
        <input className="input" style={{ maxWidth: 300 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" />
        <button className="btn"><Plus size={15} />Ajouter</button>
      </form>
      {del && (
        <Modal title={`Supprimer « ${del.name} »`} onClose={() => setDel(null)} footer={<><button className="btn ghost" onClick={() => setDel(null)}>Annuler</button><button className="btn primary" onClick={remove}>Supprimer</button></>}>
          <p className="mb">Que faire des activités et objectifs de cette catégorie ?</p>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {cats.filter((c) => c.id !== del.id).map((c) => <option key={c.id} value={c.id}>Les déplacer vers « {c.name} »</option>)}
            <option value="">Les laisser sans catégorie (« Autre »)</option>
          </select>
          {settings && null}
        </Modal>
      )}
    </Section>
  );
}

function Availability() {
  const s = useSettings();
  const av = s.availability || {};
  const plan = s.planning || {};
  const setAv = (d, list) => store.put('settings', { id: 'main', availability: { ...av, [d]: list } });
  const setPlan = (p) => store.put('settings', { id: 'main', planning: { ...plan, ...p } });
  return (
    <Section id="planification" title="Disponibilités et planification" sub="Utilisées uniquement pour te proposer des créneaux de révision. Rien n'est placé sans ton accord. Aucune heure de réveil ou de coucher n'est imposée.">
      <div className="stack-sm">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="row wrap" style={{ gap: 6 }}>
            <strong className="small" style={{ width: 90 }}>{WEEKDAYS_LONG[d]}</strong>
            {(av[d] || []).map((w, i) => (
              <span key={i} className="row" style={{ gap: 4, background: 'var(--surface-2)', borderRadius: 10, padding: '2px 6px' }}>
                <input className="input" type="time" style={{ width: 110, minHeight: 32 }} value={w.start} onChange={(e) => setAv(d, av[d].map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} aria-label={`Début ${WEEKDAYS_LONG[d]}`} />
                –<input className="input" type="time" style={{ width: 110, minHeight: 32 }} value={w.end} onChange={(e) => setAv(d, av[d].map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} aria-label={`Fin ${WEEKDAYS_LONG[d]}`} />
                <button className="btn ghost icon sm" aria-label="Retirer le créneau" onClick={() => setAv(d, av[d].filter((_, j) => j !== i))}><X size={13} /></button>
              </span>
            ))}
            <button className="btn sm" onClick={() => setAv(d, [...(av[d] || []), { start: '14:00', end: '17:00' }])}><Plus size={13} />Créneau</button>
            <label className="small row" style={{ gap: 4 }}><input type="checkbox" checked={(plan.restDays || []).includes(d)} onChange={(e) => setPlan({ restDays: e.target.checked ? [...(plan.restDays || []), d] : (plan.restDays || []).filter((x) => x !== d) })} />jour de repos</label>
          </div>
        ))}
      </div>
      <div className="form-grid mt">
        <Field label="Durée d'une séance (min)"><input className="input" type="number" step="15" defaultValue={plan.sessionMin ?? 60} onBlur={(e) => setPlan({ sessionMin: Number(e.target.value) || 60 })} /></Field>
        <Field label="Pause entre deux séances (min)"><input className="input" type="number" step="5" defaultValue={plan.breakMin ?? 15} onBlur={(e) => setPlan({ breakMin: Number(e.target.value) || 0 })} /></Field>
        <Field label="Maximum d'étude personnelle par jour (min)"><input className="input" type="number" step="15" defaultValue={plan.maxStudyMinPerDay ?? 180} onBlur={(e) => setPlan({ maxStudyMinPerDay: Number(e.target.value) || 60 })} /></Field>
        <Field label="Temps libre préservé par jour (min)" hint="Gardé pour le repos et les imprévus."><input className="input" type="number" step="15" defaultValue={plan.keepFreeMin ?? 60} onBlur={(e) => setPlan({ keepFreeMin: Number(e.target.value) || 0 })} /></Field>
      </div>
    </Section>
  );
}

function Notifications() {
  const s = useSettings();
  const n = s.notifications || {};
  const set = (p) => store.put('settings', { id: 'main', notifications: { ...n, ...p } });
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  const enable = async () => {
    if (!supported) { set({ enabled: true }); toast('Rappels activés dans l\'application. Ce navigateur ne gère pas les notifications système.'); return; }
    const p = await Notification.requestPermission();
    setPerm(p);
    set({ enabled: p === 'granted' });
    toast(p === 'granted' ? 'Notifications activées.' : 'Notifications refusées par le navigateur.');
  };
  const test = async () => {
    try { const reg = await navigator.serviceWorker?.getRegistration?.(); if (reg) await reg.showNotification('Life Planner', { body: 'Les notifications fonctionnent.' }); else new Notification('Life Planner', { body: 'Les notifications fonctionnent.' }); } catch (e) { toast('Échec : ' + e.message); }
  };
  const Toggle = ({ k, label }) => <label className="row small"><input type="checkbox" checked={!!n[k]} onChange={(e) => set({ [k]: e.target.checked })} />{label}</label>;
  return (
    <Section id="notifications" title="Rappels et notifications">
      <div className="banner mb"><Bell size={16} /><div>Les rappels sont toujours visibles dans l'application (cloche en haut). Les notifications système s'affichent quand l'application est ouverte ou active en arrière-plan. Sur iPhone, il faut d'abord l'<strong>ajouter à l'écran d'accueil</strong> (iOS 16.4 ou plus) puis activer ici. Les notifications quand l'application est complètement fermée nécessitent un serveur d'envoi (non inclus pour l'instant).</div></div>
      <div className="row wrap mb">
        <span className="small">État : <strong>{!supported ? 'non pris en charge par ce navigateur' : perm === 'granted' ? (n.enabled ? 'activées' : 'autorisées mais désactivées') : perm === 'denied' ? 'refusées (à changer dans les réglages du navigateur)' : 'pas encore autorisées'}</strong></span>
        {!n.enabled ? <button className="btn primary sm" onClick={enable}>Activer</button> : <button className="btn sm" onClick={() => set({ enabled: false })}>Désactiver</button>}
        {perm === 'granted' && <button className="btn sm" onClick={test}>Tester</button>}
      </div>
      <div className="grid g2">
        <div className="stack-sm">
          <Toggle k="items" label="Rappels définis sur mes activités" />
          <Toggle k="exams" label="Examens et interrogations" />
          <Toggle k="deadlines" label="Échéances de travaux" />
          <Toggle k="rdv" label="Rendez-vous (1 h avant)" />
          <Toggle k="habits" label="Habitudes non faites" />
          <Toggle k="goals" label="Objectifs de la semaine (dimanche)" />
        </div>
        <div className="form-grid">
          <Field label="Examens : prévenir (jours avant)"><input className="input" type="number" min="1" value={n.examLeadDays ?? 3} onChange={(e) => set({ examLeadDays: Number(e.target.value) })} /></Field>
          <Field label="Échéances : prévenir (jours avant)"><input className="input" type="number" min="1" value={n.deadlineLeadDays ?? 1} onChange={(e) => set({ deadlineLeadDays: Number(e.target.value) })} /></Field>
          <Field label="Heure du rappel d'habitudes"><input className="input" type="time" value={n.habitTime || ''} onChange={(e) => set({ habitTime: e.target.value })} /></Field>
          <Field label="Heure du rappel d'objectifs"><input className="input" type="time" value={n.goalTime || ''} onChange={(e) => set({ goalTime: e.target.value })} /></Field>
          <Field label="Maximum par jour"><input className="input" type="number" min="1" value={n.maxPerDay ?? 6} onChange={(e) => set({ maxPerDay: Number(e.target.value) })} /></Field>
        </div>
      </div>
    </Section>
  );
}

function Account() {
  const sess = useSession();
  const pending = useStore((s) => s.pendingCount());
  const cfg = getSupabaseConfig();
  const [url, setUrl] = useState(cfg?.source === 'local' ? cfg.url : '');
  const [key, setKey] = useState(cfg?.source === 'local' ? cfg.key : '');
  const [pw, setPw] = useState('');
  if (!sess.configured) {
    return (
      <Section id="compte" title="Compte et synchronisation">
        <div className="banner mb"><Cloud size={16} /><div><strong>Synchronisation non activée.</strong> Tes données sont enregistrées de façon permanente sur cet appareil uniquement (elles restent après fermeture). Pour avoir un compte et retrouver tes données sur ton MacBook et ton iPhone, connecte un projet Supabase gratuit (voir le guide d'installation).</div></div>
        <div className="form-grid">
          <Field label="URL du projet Supabase"><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
          <Field label="Clé publique (anon / publishable)"><input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ… ou sb_publishable_…" /></Field>
        </div>
        <button className="btn primary mt" onClick={() => { if (!url.startsWith('https://') || key.length < 20) return toast('URL ou clé invalide.'); saveSupabaseConfig(url, key); location.reload(); }}>Enregistrer et redémarrer</button>
      </Section>
    );
  }
  if (!sess.user) {
    return (
      <Section id="compte" title="Compte et synchronisation">
        <p className="small mb">Tu utilises le planner sans compte : les données restent sur cet appareil.</p>
        <button className="btn primary" onClick={() => { localStorage.removeItem('lp:mode'); location.reload(); }}>Se connecter ou créer un compte</button>
        {cfg?.source === 'local' && <button className="btn ghost sm mt" onClick={() => { saveSupabaseConfig(''); location.reload(); }}>Retirer la configuration Supabase</button>}
      </Section>
    );
  }
  const st = sess.sync || {};
  return (
    <Section id="compte" title="Compte et synchronisation">
      <div className="stack-sm small">
        <div className="row between"><span>Connectée en tant que</span><strong>{sess.user.email}</strong></div>
        <div className="row between"><span>État</span><span>{st.state === 'ok' ? 'Synchronisé' : st.state === 'error' ? 'Erreur' : st.state === 'offline' ? 'Hors ligne' : st.state === 'syncing' ? 'En cours…' : st.state}</span></div>
        <div className="row between"><span>Modifications en attente d'envoi</span><span>{pending}</span></div>
        <div className="row between"><span>Dernière synchronisation</span><span>{st.lastSync ? new Date(st.lastSync).toLocaleString('fr-FR') : '—'}</span></div>
        {st.error && <div className="banner">Erreur : {st.error}. Tes modifications sont conservées sur cet appareil et seront renvoyées automatiquement.</div>}
      </div>
      <div className="row wrap mt">
        <button className="btn" onClick={() => syncNow()}><RefreshCw size={15} />Synchroniser maintenant</button>
        <button className="btn" onClick={async () => { if (pending && !(await confirmDialog({ title: 'Se déconnecter', message: `${pending} modification(s) ne sont pas encore envoyées et seront perdues sur cet appareil. Se déconnecter quand même ?`, confirm: 'Se déconnecter' }))) return; await signOut(); }}><LogOut size={15} />Se déconnecter</button>
      </div>
      <form className="row mt" onSubmit={async (e) => { e.preventDefault(); try { await updatePassword(pw); setPw(''); toast('Mot de passe modifié.'); } catch (err) { toast(err.message); } }}>
        <input className="input" style={{ maxWidth: 260 }} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" />
        <button className="btn" disabled={pw.length < 6}>Changer le mot de passe</button>
      </form>
    </Section>
  );
}

function Backup() {
  const download = () => {
    const blob = new Blob([JSON.stringify(store.exportJSON(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `life-planner-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!(await confirmDialog({ title: 'Importer une sauvegarde', message: 'Les éléments de la sauvegarde seront ajoutés ou remplaceront ceux qui ont le même identifiant. Continuer ?', confirm: 'Importer' }))) return;
      const n = store.importJSON(json);
      toast(`${n} éléments importés.`);
    } catch (err) { toast('Import impossible : ' + err.message); }
    e.target.value = '';
  };
  return (
    <Section id="sauvegarde" title="Sauvegarde" sub="Télécharge une copie complète de tes données (fichier JSON) pour la garder en sécurité, ou restaure une sauvegarde.">
      <div className="row wrap">
        <button className="btn" onClick={download}><Download size={15} />Télécharger une sauvegarde</button>
        <label className="btn"><Upload size={15} />Importer une sauvegarde<input type="file" accept="application/json" className="sr-only" onChange={upload} /></label>
      </div>
    </Section>
  );
}

function Quotes() {
  const s = useSettings();
  const list = s.quotes || [];
  const [f, setF] = useState({ text: '', author: '' });
  const save = (quotes) => store.put('settings', { id: 'main', quotes });
  return (
    <Section id="citations" title="Citations inspirantes" sub="Affichées sur l'accueil et la journée.">
      <div className="list mb">{list.map((q, i) => <div key={i} className="list-row small"><span className="serif italic" style={{ flex: 1, fontSize: '1.05rem' }}>“{q.text}”</span><span className="muted">{q.author}</span><button className="btn ghost icon sm" aria-label="Supprimer" onClick={() => save(list.filter((_, j) => j !== i))}><Trash2 size={13} /></button></div>)}</div>
      <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (!f.text.trim()) return; save([...list, { text: f.text.trim(), author: f.author.trim() || 'Anonyme' }]); setF({ text: '', author: '' }); }}>
        <input className="input" style={{ flex: '2 1 240px' }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Citation" />
        <input className="input" style={{ flex: '1 1 120px' }} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Auteur" />
        <button className="btn"><Plus size={15} />Ajouter</button>
      </form>
    </Section>
  );
}

export default function Settings() {
  const s = useSettings();
  return (
    <div>
      <PageHead eyebrow="Personnalisation" title="Paramètres" />
      <div className="stack">
        <Section id="general" title="Général">
          <div className="form-grid">
            <Field label="Nom du planner"><input className="input" defaultValue={s.appName} onBlur={(e) => store.put('settings', { id: 'main', appName: e.target.value.trim() || 'Life Planner' })} aria-label="Nom du planner" /></Field>
            <div className="field"><span id="theme-label">Thème</span>
              <div className="row" role="radiogroup" aria-labelledby="theme-label">
                {[['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Automatique']].map(([id, l]) => <button key={id} className={'btn' + (s.theme === id ? ' primary' : '')} onClick={() => store.put('settings', { id: 'main', theme: id })} role="radio" aria-checked={s.theme === id}>{l}</button>)}
              </div>
            </div>
          </div>
        </Section>
        <Account />
        <Categories />
        <Availability />
        <Notifications />
        <Quotes />
        <Backup />
        <p className="xs muted center">Life Planner · données privées · aucun mot de passe n'est stocké dans l'application</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { signIn, signUp, resetPassword, useLocalOnly } from '../lib/session.js';
import { Field } from '../components/ui.jsx';
import { LibraryArt } from '../components/icons.jsx';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await signIn(email, pw);
      else if (mode === 'signup') { const confirm = await signUp(email, pw); if (confirm) setMsg({ ok: true, text: 'Compte créé. Ouvre le lien de confirmation reçu par e-mail, puis connecte-toi.' }); }
      else { await resetPassword(email); setMsg({ ok: true, text: 'Si un compte existe, un e-mail de réinitialisation a été envoyé.' }); }
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ color: 'var(--gold)', textAlign: 'center' }}><LibraryArt size={170} /></div>
        <h1 className="center" style={{ marginTop: 8 }}>Life Planner</h1>
        <p className="center muted small mb" style={{ marginTop: 4 }}>{mode === 'login' ? 'Connecte-toi pour retrouver ton planner sur tous tes appareils.' : mode === 'signup' ? 'Crée ton compte personnel.' : 'Réinitialiser le mot de passe'}</p>
        <form className="stack" onSubmit={submit}>
          <Field label="Adresse e-mail"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {mode !== 'reset' && <Field label="Mot de passe" hint={mode === 'signup' ? 'Au moins 6 caractères. Il est chiffré par Supabase, jamais stocké en clair.' : null}><input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>}
          {msg && <div className={'banner' + (msg.ok ? ' info' : '')}>{msg.text}</div>}
          <button className="btn primary" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
        </form>
        <div className="row wrap between mt small">
          {mode !== 'login' ? <button className="btn ghost sm" onClick={() => setMode('login')}>J'ai déjà un compte</button> : <button className="btn ghost sm" onClick={() => setMode('signup')}>Créer un compte</button>}
          {mode === 'login' && <button className="btn ghost sm" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
        <button className="btn ghost sm" style={{ width: '100%' }} onClick={useLocalOnly}>Continuer sans compte (données sur cet appareil uniquement)</button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, signUp, resetPassword, resendConfirmation, updatePassword, endRecovery, useLocalOnly } from '../lib/session.js';
import { Field } from '../components/ui.jsx';
import { LibraryArt } from '../components/icons.jsx';

const EMAIL_PROPS = { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false };
const NOT_CONFIRMED = "Ton adresse e-mail n'est pas encore confirmée. Ouvre le lien reçu par e-mail (regarde aussi les spams), ou renvoie-le ci-dessous.";

function PasswordInput({ value, onChange, autoComplete, testid }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" data-testid={testid} type={show ? 'text' : 'password'} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={6} value={value} onChange={onChange} style={{ paddingRight: 44 }} />
      <button type="button" className="btn ghost icon sm" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShow(!show)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );
}

function Shell({ subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ color: 'var(--gold)', textAlign: 'center' }}><LibraryArt size={170} /></div>
        <h1 className="center" style={{ marginTop: 8 }}>Life Planner</h1>
        <p className="center muted small mb" style={{ marginTop: 4 }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function NewPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ ok: false, text: 'Les deux mots de passe ne sont pas identiques.' }); return; }
    setBusy(true); setMsg(null);
    try { await updatePassword(pw); } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };
  return (
    <Shell subtitle="Choisis un nouveau mot de passe.">
      <form className="stack" onSubmit={submit}>
        <Field label="Nouveau mot de passe" hint="Au moins 6 caractères."><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirme le mot de passe"><PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        {msg && <div className={'banner' + (msg.ok ? ' info' : '')}>{msg.text}</div>}
        <button className="btn primary" disabled={busy}>{busy ? '…' : 'Enregistrer le mot de passe'}</button>
        <button type="button" className="btn ghost sm" onClick={endRecovery}>Plus tard</button>
      </form>
    </Shell>
  );
}

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const switchMode = (m) => { setMode(m); setMsg(null); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await signIn(email, pw);
      else if (mode === 'signup') { const confirm = await signUp(email, pw); if (confirm) setMsg({ ok: true, unconfirmed: true, text: 'Compte créé. Ouvre le lien de confirmation reçu par e-mail (regarde aussi les spams), puis connecte-toi.' }); }
      else { await resetPassword(email); setMsg({ ok: true, text: 'Si un compte existe avec cette adresse, un e-mail avec un lien a été envoyé. Ouvre-le sur cet appareil pour choisir un nouveau mot de passe.' }); }
    } catch (err) {
      setMsg(err.message === 'NOT_CONFIRMED' ? { ok: false, unconfirmed: true, text: NOT_CONFIRMED } : { ok: false, text: err.message });
    }
    setBusy(false);
  };
  const resend = async () => {
    setBusy(true);
    try { await resendConfirmation(email); setMsg({ ok: true, unconfirmed: true, text: 'E-mail de confirmation renvoyé. Regarde ta boîte de réception et les spams.' }); }
    catch (err) { setMsg({ ok: false, unconfirmed: true, text: err.message }); }
    setBusy(false);
  };
  const subtitle = mode === 'login' ? 'Connecte-toi pour retrouver ton planner sur tous tes appareils.' : mode === 'signup' ? 'Crée ton compte personnel.' : 'Réinitialiser le mot de passe';
  return (
    <Shell subtitle={subtitle}>
      <form className="stack" onSubmit={submit}>
        <Field label="Adresse e-mail"><input className="input" {...EMAIL_PROPS} required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode !== 'reset' && <Field label="Mot de passe" hint={mode === 'signup' ? 'Au moins 6 caractères. Il est chiffré par Supabase, jamais stocké en clair.' : null}><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>}
        {msg && <div className={'banner' + (msg.ok ? ' info' : '')} role="alert" data-testid="auth-msg">{msg.text}</div>}
        {msg?.unconfirmed && email && <button type="button" className="btn sm" disabled={busy} onClick={resend}>Renvoyer l'e-mail de confirmation</button>}
        <button className="btn primary" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
      </form>
      <div className="row wrap between mt small">
        {mode !== 'login' ? <button className="btn ghost sm" onClick={() => switchMode('login')}>J'ai déjà un compte</button> : <button className="btn ghost sm" onClick={() => switchMode('signup')}>Créer un compte</button>}
        {mode === 'login' && <button className="btn ghost sm" onClick={() => switchMode('reset')}>Mot de passe oublié</button>}
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '16px 0' }} />
      <button className="btn ghost sm" style={{ width: '100%' }} onClick={useLocalOnly}>Continuer sans compte (données sur cet appareil uniquement)</button>
    </Shell>
  );
}

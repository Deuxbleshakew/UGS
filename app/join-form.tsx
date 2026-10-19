'use client';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowRight, Loader2, LockKeyhole} from 'lucide-react';
import UgsBrand from './ugs-brand';
import PasswordInput from './password-input';
import {passwordProblem} from '@/lib/password-rules';

/** Public sign-up page opened from the organizer's shared join link: /join#code=... */
export default function JoinForm() {
  const [code, setCode] = useState(''), [name, setName] = useState(''), [username, setUsername] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    setCode(new URLSearchParams(window.location.hash.slice(1)).get('code') || '');
    window.history.replaceState(null, '', '/join');
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (password !== confirm) {setError('The passwords do not match.'); return;}
    const weak = passwordProblem(password);
    if (weak) {setError(weak); return;}
    setBusy(true);
    try {
      const response = await fetch('/api/auth/join', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: code, name, username, password})});
      const data = await response.json().catch(() => ({})) as {error?: string};
      if (!response.ok) {setError(data.error || 'Could not create your account. Please try again.'); setBusy(false); return;}
      window.location.assign('/');
    } catch {setError('The server is unavailable. Please try again.'); setBusy(false);}
  }
  return <main className="auth-page ugs-auth"><div className="ugs-auth-intro"><a className="ugs-brand-link" href="/login" aria-label="Union Gaming Society"><UgsBrand /></a><div className="eyebrow">WELCOME TO UNION GAMING</div><p>Different players. One Union.</p><div className="ugs-auth-sections"><span>UCL</span><span>Club Champions</span><span>RB Tiquicia</span></div></div>
    <section className="auth-card"><div className="eyebrow">UGS · YOU'RE INVITED</div><h1>Join Union Gaming.</h1><p className="muted">Set up your account in a minute. Your organizer will see you in the player list straight away.</p>
      <form onSubmit={submit}>
        <label className="field">Your name<input type="text" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy}/></label>
        <label className="field">Username<input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={username} onChange={e => setUsername(e.target.value)} disabled={busy} aria-describedby="join-username-help"/></label>
        <p id="join-username-help" className="fine-print">3–24 letters, numbers or underscores. You sign in with it; your organizer can change it later if needed.</p>
        <label className="field">Create password<PasswordInput autoComplete="new-password" required minLength={8} maxLength={200} value={password} onChange={e => setPassword(e.target.value)}/></label>
        <label className="field">Confirm password<PasswordInput autoComplete="new-password" required minLength={8} maxLength={200} value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
        <p className="fine-print">Use at least 8 characters.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        {!code && <p className="notice">Open the complete join link from your organizer. If you refreshed this page, reopen that link.</p>}
        <button className="btn primary full" disabled={busy || !code}>{busy ? <Loader2 className="spin" size={17}/> : <ArrowRight size={17}/>} Create my account</button>
      </form>
      <p className="auth-note"><LockKeyhole size={14}/>Already registered? <a href="/login">Sign in</a></p></section></main>;
}

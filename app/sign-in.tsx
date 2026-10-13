'use client';
import { useEffect,useState,useRef,type FormEvent } from 'react';
import { Trophy,ArrowRight,Loader2,LockKeyhole } from 'lucide-react';
export default function SignIn({activate=false}:{activate?:boolean}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const tokenRead=useRef(false);
  useEffect(()=>{if(activate&&!tokenRead.current){tokenRead.current=true;setToken(new URLSearchParams(window.location.hash.slice(1)).get('token')||'');window.history.replaceState(null,'','/activate');}},[activate]);
  async function submit(e:FormEvent){e.preventDefault();setError('');if(activate&&password!==confirm){setError('The passwords do not match.');return;}setBusy(true);
    try{const response=await fetch('/api/auth/'+(activate?'activate':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(activate?{token,password}:{email,password})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Unable to sign in.');window.location.assign('/');}
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <main className="auth-page"><section className="auth-card"><a className="brand" href="/login"><span className="brand-icon"><Trophy size={24}/></span>matchroom<span className="brand-dot">.</span></a><div className="eyebrow">YOUR TOURNAMENT. TOGETHER.</div><h1>{activate?'Join your team.':'Welcome back.'}</h1><p className="muted">{activate?'Choose a password to activate the manager account your organizer invited.':'Sign in to manage your clubs, report results and follow the season.'}</p><form onSubmit={submit}>
    {!activate&&<label className="field">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>}
    <label className="field">{activate?'Create password':'Password'}<input type="password" autoComplete={activate?'new-password':'current-password'} required minLength={activate?12:1} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {activate&&<><label className="field">Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p className="fine-print">Use at least 12 characters. Invitation links expire after 72 hours.</p></>}
    {error&&<p className="notice error" role="alert">{error}</p>}{activate&&!token&&<p className="notice">Open the complete invitation link from your organizer. If you refreshed this page, reopen that link.</p>}
    <button className="btn primary full" disabled={busy||(activate&&!token)}>{busy?<Loader2 className="spin" size={17}/>:<ArrowRight size={17}/>} {activate?'Activate account':'Sign in'}</button></form><p className="auth-note"><LockKeyhole size={14}/>{activate?'Already registered?':'Access is by invitation.'} {activate?<a href="/login">Sign in</a>:'Ask your organizer for a manager account.'}</p></section></main>;
}

'use client';
import { useEffect,useState,useRef,type FormEvent } from 'react';
import { ArrowRight,Loader2,LockKeyhole } from 'lucide-react';
import UgsBrand from './ugs-brand';
import {takeDiscordResult} from './discord-connection';
export default function SignIn({activate=false}:{activate?:boolean}){
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const tokenRead=useRef(false);
  const [discord,setDiscord]=useState(false),[notice,setNotice]=useState<{text:string;error?:boolean}|null>(null);
  useEffect(()=>{if(activate)return;setNotice(takeDiscordResult());fetch('/api/discord/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>setDiscord(!!(s as {configured?:boolean}|null)?.configured)).catch(()=>undefined);},[activate]);
  async function discordSignIn(){setError('');setBusy(true);
    try{const response=await fetch('/api/discord/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json() as {url?:string;error?:string};if(!response.ok||!data.url)throw new Error(data.error||'Discord sign-in is unavailable.');window.location.assign(data.url);}
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  useEffect(()=>{if(activate&&!tokenRead.current){tokenRead.current=true;setToken(new URLSearchParams(window.location.hash.slice(1)).get('token')||'');window.history.replaceState(null,'','/activate');}},[activate]);
  async function submit(e:FormEvent){e.preventDefault();setError('');if(activate&&password!==confirm){setError('The passwords do not match.');return;}setBusy(true);
    try{const response=await fetch('/api/auth/'+(activate?'activate':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(activate?{token,password}:{identifier,password})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Unable to sign in.');window.location.assign('/');}
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <main className="auth-page ugs-auth"><div className="ugs-auth-intro"><a className="ugs-brand-link" href="/login" aria-label="Union Gaming Society"><UgsBrand /></a><div className="eyebrow">WELCOME TO UNION GAMING</div><p>Our community. Our teams. Our games.</p><div className="ugs-auth-sections"><span>Matchroom</span><span>Club Champions</span><span>RB Tiquicia</span></div></div><section className="auth-card"><div className="eyebrow">UGS · MEMBERS ONLY</div><h1>{activate?'Join Union Gaming.':'Welcome back.'}</h1><p className="muted">{activate?'Choose a password to activate the account your organizer invited.':'Sign in to follow your competitions and connect with your community.'}</p><form onSubmit={submit}>
    {!activate&&<><label className="field">Username<input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={identifier} onChange={e=>setIdentifier(e.target.value)} maxLength={254} aria-describedby="username-help"/></label><p id="username-help" className="fine-print">No username assigned yet? Use your existing email until your organizer assigns one.</p></>}
    <label className="field">{activate?'Create password':'Password'}<input type="password" autoComplete={activate?'new-password':'current-password'} required minLength={activate?12:1} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {activate&&<><label className="field">Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p className="fine-print">Use at least 12 characters. Invitation links expire after 72 hours.</p></>}
    {error&&<p className="notice error" role="alert">{error}</p>}{activate&&!token&&<p className="notice">Open the complete invitation link from your organizer. If you refreshed this page, reopen that link.</p>}
    <button className="btn primary full" disabled={busy||(activate&&!token)}>{busy?<Loader2 className="spin" size={17}/>:<ArrowRight size={17}/>} {activate?'Activate account':'Sign in'}</button></form>{!activate&&discord&&<><p className="fine-print auth-or">or</p><button type="button" className="btn secondary full" disabled={busy} onClick={()=>void discordSignIn()}>Sign in with Discord</button><p className="fine-print">Works only after you connect Discord from My Profile. It never creates an account.</p></>}{notice&&<p className={'notice'+(notice.error?' error':'')} role={notice.error?'alert':'status'}>{notice.text}</p>}<p className="auth-note"><LockKeyhole size={14}/>{activate?'Already registered?':'Access is by invitation.'} {activate?<a href="/login">Sign in</a>:'Ask your organizer for access.'}</p></section></main>;
}

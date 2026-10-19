'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import UgsBrand from './ugs-brand';
import PasswordInput from './password-input';
import {passwordProblem} from '@/lib/password-rules';

export default function ResetPassword(){
  const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[complete,setComplete]=useState(false);
  const read=useRef(false);
  useEffect(()=>{if(read.current)return;read.current=true;setToken(new URLSearchParams(window.location.hash.slice(1)).get('token')??'');window.history.replaceState(null,'','/reset-password');},[]);
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(password!==confirm){setError('The new passwords do not match.');return;}
    const weak=passwordProblem(password);if(weak){setError(weak);return;}
    setBusy(true);
    try{
      const response=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??'The password could not be reset.');
      setComplete(true);setToken('');setPassword('');setConfirm('');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="auth-page ugs-auth"><div className="ugs-auth-intro"><a className="ugs-brand-link" href="/login" aria-label="Union Gaming Society"><UgsBrand/></a><div className="eyebrow">WELCOME TO UNION GAMING</div><p>Different players. One Union.</p></div>
    <section className="auth-card"><div className="eyebrow">UGS · ACCOUNT RECOVERY</div><h1>{complete?'Password changed.':'Choose a new password.'}</h1>
      {complete?<><p>Your old sessions have been signed out. Use your username and new password to sign in.</p><a className="btn primary full" href="/login">Go to sign in <ArrowRight size={17}/></a></>
      :<><p className="muted">Use the private link from your organizer. It expires after one hour and works once.</p>
        <form onSubmit={event=>void submit(event)}><label className="field">New password<PasswordInput value={password} onChange={event=>setPassword(event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password"/></label>
          <label className="field">Repeat new password<PasswordInput value={confirm} onChange={event=>setConfirm(event.target.value)} required minLength={8} maxLength={200} autoComplete="new-password"/></label>
          {error&&<p className="notice error" role="alert">{error}</p>}{!token&&<p className="notice">Open the complete reset link. If you refreshed this page, reopen the link from your organizer.</p>}
          <button className="btn primary full" disabled={busy||!token}>{busy?'Saving…':'Reset password'} <ArrowRight size={17}/></button></form></>}
      <p className="auth-note"><LockKeyhole size={14}/>Need another link? Ask your organizer.</p>
    </section></main>;
}

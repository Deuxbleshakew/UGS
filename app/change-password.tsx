'use client';
import {useState,type FormEvent} from 'react';
import {api} from './ui';

export default function ChangePassword(){
  const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[again,setAgain]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;setError('');setMessage('');
    if(next!==again){setError('The new passwords do not match.');return;}
    setBusy(true);
    try{
      const r=await api<{otherSessionsEnded:number}>('account/password',{current,next});
      setCurrent('');setNext('');setAgain('');
      setMessage(r.otherSessionsEnded?`Password changed. ${r.otherSessionsEnded} other signed-in device${r.otherSessionsEnded===1?' was':'s were'} signed out.`:'Password changed.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <form className="password-card" onSubmit={event=>void submit(event)}>
    <h2>Change password</h2>
    <label className="field">Current password<input type="password" value={current} onChange={e=>setCurrent(e.target.value)} required autoComplete="current-password" maxLength={200} disabled={busy}/></label>
    <label className="field">New password <span className="muted">12 or more characters</span><input type="password" value={next} onChange={e=>setNext(e.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" disabled={busy}/></label>
    <label className="field">Repeat new password<input type="password" value={again} onChange={e=>setAgain(e.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" disabled={busy}/></label>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    <button className="btn primary" disabled={busy||!current||next.length<12||!again}>{busy?'Changing…':'Change password'}</button>
    <p className="fine-print">Other devices you are signed in on will be signed out. This device stays signed in.</p>
  </form>;
}

'use client';
import {useState} from 'react';
import {api} from './ui';
import type {ProfileState} from '@/lib/profile';

type Choice=ProfileState['participation'];

/** First-sign-in question. Yes continues to the profile form; No makes the person a viewer. */
export function ParticipationQuestion({onDone}:{onDone:()=>Promise<unknown>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function answer(value:'yes'|'no'){
    if(busy)return;setBusy(true);setError('');
    try{await api('participation',{answer:value});await onDone();}catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <section className="panel participation-card" aria-labelledby="participation-title">
    <h1 id="participation-title">Do you want to take part in the UCL tournament?</h1>
    <p>Taking part means you play matches, arrange kickoff times and can invite others to friendlies. You will fill in a short player profile first.</p>
    <p>If you would rather just follow along, choose No. You will see the tournament pages but won’t be a player. There is more for followers that we will add later. You can change your mind any time in My Profile.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <div className="participation-actions">
      <button type="button" className="btn primary" disabled={busy} onClick={()=>void answer('yes')}>Yes, I want to play</button>
      <button type="button" className="btn secondary" disabled={busy} onClick={()=>void answer('no')}>No, I just want to follow</button>
    </div>
  </section>;
}

/** Lives in My Profile: shows the current choice and lets the person change it. */
export function ParticipationSetting({value,participant,onChanged}:{value:Choice;participant:boolean;onChanged:()=>Promise<unknown>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function change(answer:'yes'|'no'){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      const r=await api<{participation:Choice}>('participation',{answer});
      setMessage(r.participation==='pending'?'Request sent. The organizer will approve it. Until then you stay a viewer.':r.participation==='no'?'You are now a viewer. Your open friendlies and waiting kickoff proposals were closed.':'Saved.');
      await onChanged();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  // Accounts that were never asked and are already players can still step back to being a viewer.
  if(value==='unanswered'&&!participant)return null;
  const text=value==='yes'||value==='unanswered'?'You are taking part in the tournament.':value==='pending'?'You asked to take part. Waiting for the organizer to approve. Until then you stay a viewer.':'You are following as a viewer.';
  return <div className="participation-setting">
    <h2>Tournament participation</h2>
    <p>{text}</p>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    {(value==='yes'||value==='unanswered')&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void change('no')}>Switch to viewer</button>}
    {value==='no'&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void change('yes')}>Ask to take part</button>}
    {value==='pending'&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void change('no')}>Cancel request</button>}
  </div>;
}

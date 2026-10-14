'use client';
import {useState} from 'react';
import {Copy,Plus,ShieldCheck,Users} from 'lucide-react';
import {api,type AppState} from './ui';

export default function UserAccess({state,onRefresh}:{state:AppState|null;onRefresh:()=>Promise<unknown>}){
  const [profile,setProfile]=useState('new'),[name,setName]=useState(''),[email,setEmail]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[activation,setActivation]=useState(''),[copied,setCopied]=useState(false);
  const admin=state?.user.isOwner&&state.member?.role==='admin',creating=profile==='new';
  async function save(){
    if(!admin||!state?.tournament)return;
    setBusy(true);setMessage('');setError('');setActivation('');setCopied(false);
    try{
      const endpoint=`tournament/${state.tournament.id}/${creating?'users':'invite'}`;
      const access=await api<{token:string|null;existingAccount:boolean}>(endpoint,creating?{name,email}:{email,playerId:profile});
      if(access.token)setActivation(window.location.origin+'/activate#token='+access.token);
      setMessage(access.existingAccount?'Player access granted. They can sign in with their existing account.':'Player account reserved. Share the private link so they can choose a password and activate it.');
      setName('');setEmail('');
      await onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function copy(){try{await navigator.clipboard.writeText(activation);setCopied(true);}catch{setError('Select the private link and copy it manually.');}}
  return <section className="panel settings-card">
    <span className="setting-icon"><Users size={23}/></span><h2>Users & access</h2>
    {admin?<>
      <p>Your profile is the only admin. Create player accounts here, or give an existing player sign-in access.</p>
      <div className="notice"><ShieldCheck size={17}/><span>New accounts are players. Only you can create users, manage tournaments and approve results.</span></div>
      <form onSubmit={e=>{e.preventDefault();void save();}}>
        <label className="field">Player profile<select value={profile} disabled={busy} onChange={e=>{setProfile(e.target.value);setMessage('');setError('');}}><option value="new">Create a new player</option><optgroup label="Existing players">{(state.players??[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select></label>
        {creating&&<label className="field">Player / gamer name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required disabled={busy} autoComplete="off" placeholder="Display name"/></label>}
        <label className="field">Account email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required disabled={busy} autoComplete="off" placeholder="player@example.com"/></label>
        <button className="btn primary" disabled={busy||!email.trim()||(creating&&!name.trim())}><Plus size={16}/>{busy?'Saving…':creating?'Create user':'Grant player access'}</button>
      </form>
      {message&&<p className="notice" role="status">{message}</p>}
      {error&&<p className="notice error" role="alert">{error}</p>}
      {activation&&<div><label className="field">Private activation link · valid for 72 hours<input readOnly value={activation} onFocus={e=>e.target.select()}/></label><button className="btn secondary" onClick={copy}><Copy size={15}/>{copied?'Copied':'Copy private link'}</button><p className="fine-print">Share directly with this player. Select their existing profile and grant access again to replace an unused link.</p></div>}
      <h3 className="form-section-title">Tournament users</h3>
      <div className="member-list">{state.members?.map(m=><div key={m.id}><span className="avatar small">{m.name[0]}</span><span><b>{m.name}</b><small>{m.email}</small><small>{m.role==='admin'?'Admin · you':'Player'}</small></span><span className="pot-tag">{m.user_id?'Active':'Pending'}</span></div>)}</div>
      <p className="fine-print">There is no public sign-up or player limit of 12. Activation links are shared manually; the app does not send email.</p>
    </>:<p className="notice">Only the site owner can create users and manage account access.</p>}
  </section>;
}

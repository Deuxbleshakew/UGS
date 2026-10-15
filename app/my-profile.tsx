'use client';
import {useState,type FormEvent} from 'react';
import seed from '@/data/draw-config.json';
import {teamKey,type ProfileState,type ProfileData} from '@/lib/profile';
import {teamChoices} from '@/lib/team-catalog';
import {commonTimezones} from '@/lib/timezone';
import {api} from './ui';
import DiscordConnection from './discord-connection';
import AvatarPicker from './avatar-picker';
import ChangePassword from './change-password';

export default function MyProfile({profile,username,userId,onRefresh}:{profile:ProfileState;username:string|null;userId:string;onRefresh:()=>Promise<unknown>}){
  const [data,setData]=useState<ProfileData>(profile.data),[query,setQuery]=useState(''),[other,setOther]=useState(''),[kind,setKind]=useState<'football'|'community'>('football'),[otherZone,setOtherZone]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const choices=teamChoices(seed.clubs.map(c=>c.name));
  const timezoneOptions=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):['America/Costa_Rica','America/New_York','America/Chicago','America/Los_Angeles','UTC'];
  function field<K extends keyof ProfileData>(key:K,value:ProfileData[K]){setData(previous=>({...previous,[key]:value}));}
  function add(team:ProfileData['teams'][number]){
    const clean={...team,name:team.name.trim()};if(!clean.name)return;
    if(data.teams.some(t=>teamKey(t)===teamKey(clean)))return;
    if(data.teams.length>=30){setError('Follow up to 30 teams.');return;}
    field('teams',[...data.teams,clean]);setOther('');
  }
  function remove(key:string){setData(previous=>({...previous,teams:previous.teams.filter(t=>teamKey(t)!==key),primary:previous.primary===key?null:previous.primary}));}
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{const saved=await api<ProfileState>('profile',{data,version:profile.version});
      setMessage(saved.complete?'Profile saved.':'Saved. Still needed: '+saved.missing.join(', '));await onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel profile-panel"><h1>My Profile</h1>
    <p>Choose the teams you follow and add your gaming details. Following a team does not enter you into a tournament or change your Elo.</p>
    {!profile.complete&&<p className="notice">Still needed: {profile.missing.join(', ')}.</p>}
    <form onSubmit={event=>void save(event)}><fieldset disabled={busy} className="profile-fields">
      <label className="field">Username<input readOnly value={username??'Not assigned yet'}/></label>
      {!username&&<p className="notice">You can save your details now. Ask the owner to assign your username to finish setup.</p>}
      <label className="field">Display name<input required maxLength={80} value={data.displayName} onChange={e=>field('displayName',e.target.value)}/></label>
      <h2>Teams you follow</h2>
      <label className="field">Search teams<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search football or community teams"/></label>
      <div className="profile-team-options">{choices.filter(t=>t.name.toLowerCase().includes(query.toLowerCase())).map(t=><label key={teamKey(t)}><input type="checkbox" checked={data.teams.some(x=>teamKey(x)===teamKey(t))} onChange={e=>e.target.checked?add(t):remove(teamKey(t))}/><span>{t.name}<small>{t.kind==='football'?'Football club':'Community Clubs team'}</small></span></label>)}</div>
      <div className="profile-other"><label className="field">Other team type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="football">Football club</option><option value="community">Community Clubs team</option></select></label><label className="field">Other team name<input maxLength={80} value={other} onChange={e=>setOther(e.target.value)}/></label><button type="button" className="btn secondary" disabled={!other.trim()} onClick={()=>add({kind,name:other})}>Add team</button></div>
      <ul className="profile-followed">{data.teams.map(t=><li key={teamKey(t)}>{t.name} · {t.kind==='football'?'Football':'Community'} <button className="text-btn" type="button" onClick={()=>remove(teamKey(t))} aria-label={'Unfollow '+t.name}>Remove</button></li>)}</ul>
      <label className="field">Primary favorite (optional)<select value={data.primary??''} onChange={e=>field('primary',e.target.value||null)}><option value="">No primary favorite</option>{data.teams.map(t=><option key={teamKey(t)} value={teamKey(t)}>{t.name} · {t.kind}</option>)}</select></label>
      <h2>Gaming details</h2><p>{profile.participant?'Required for your participant access.':'Optional for viewers; required if you later become a participant.'} IDs are self-reported and unverified.</p>
      <div className="profile-platforms">{(['PlayStation','PC','Xbox'] as const).map(p=><label key={p}><input type="checkbox" checked={data.platforms.includes(p)} onChange={e=>field('platforms',e.target.checked?[...data.platforms,p]:data.platforms.filter(x=>x!==p))}/>{p}</label>)}</div>
      {data.platforms.includes('PlayStation')&&<label className="field">PlayStation Online ID<input value={data.psnId} maxLength={80} onChange={e=>field('psnId',e.target.value)}/></label>}
      {data.platforms.some(p=>p==='PC'||p==='Xbox')&&<label className="field">EA ID · PC / Xbox<input value={data.eaId} maxLength={80} onChange={e=>field('eaId',e.target.value)}/></label>}
      <label className="field">Timezone<select value={otherZone||!commonTimezones.some(z=>z.value===data.timezone)&&data.timezone?'__other':data.timezone} onChange={e=>{if(e.target.value==='__other'){setOtherZone(true);}else{setOtherZone(false);field('timezone',e.target.value);}}}><option value="">Choose your timezone</option>{commonTimezones.map(z=><option key={z.value} value={z.value}>{z.label} · {z.value}</option>)}<option value="__other">Other timezone…</option></select></label>
      {(otherZone||(!!data.timezone&&!commonTimezones.some(z=>z.value===data.timezone)))&&<label className="field">Other timezone <small>Full list, for example Asia/Tokyo</small><input list="profile-timezones" value={data.timezone} maxLength={100} placeholder="Region/City" onChange={e=>field('timezone',e.target.value)}/><datalist id="profile-timezones">{timezoneOptions.map(t=><option key={t} value={t}/>)}</datalist></label>}
      <button type="button" className="text-btn" onClick={()=>field('timezone',Intl.DateTimeFormat().resolvedOptions().timeZone)}>Use this device’s timezone</button>
      <p className="fine-print">Gaming IDs and timezone are stored in your private account profile. Your tournament assignments and historical player names stay unchanged.</p>
      <button className="btn primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button>
    </fieldset></form>
    {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p className="notice" role="status">{message}</p>}
    <AvatarPicker userId={userId} name={data.displayName||username||'You'}/>
    <DiscordConnection/>
    <ChangePassword/>
  </section>;
}

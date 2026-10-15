'use client';
import {useCallback,useEffect,useState} from 'react';
import {formatInZone,validTimezone,zonedLocalToUtc,zoneMessages} from '@/lib/timezone';
import {api} from './ui';
import {Avatar} from './avatar-picker';

type Invitation={id:string;status:string;proposedAt:string;proposedLocal:string;proposerTimezone:string;message:string|null;version:number;direction:'sent'|'received';myTurn:boolean;proposedByMe:boolean;otherName:string;otherId:string;otherAvatar:number|null};
type Ev={id:string;invitationId:string;actorName:string;at:string;action:string;reason:string|null;proposedAt:string|null};
type Data={now:string;me:{eligible:boolean;reason:string|null;timezone:string;maxPending:number};invitations:Invitation[];events:Ev[];directory:{id:string;name:string}[]};
const statusText:Record<string,string>={pending:'Waiting for an answer',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};
const eventText:Record<string,string>={invited:'Invited',countered:'Counter-proposed',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};

export default function Friendlies({timezone}:{timezone?:string}){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [who,setWho]=useState(''),[when,setWhen]=useState(''),[message,setMessage]=useState(''),[counterFor,setCounterFor]=useState<string|null>(null);
  const zone=timezone&&validTimezone(timezone)?timezone:Intl.DateTimeFormat().resolvedOptions().timeZone;
  const load=useCallback(async()=>{try{setData(await api<Data>('friendlies'));}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void load();},[load]);
  async function send(body:Record<string,unknown>){
    setBusy(true);setError('');
    try{await api('friendlies',body);setWho('');setWhen('');setMessage('');setCounterFor(null);await load();}
    catch(e){setError((e as Error).message);await load();}finally{setBusy(false);}
  }
  if(!data)return <section className="panel friendlies-panel">{error?<p className="inline-error" role="alert">{error}</p>:<p className="fine-print">Loading…</p>}</section>;
  const preview=(()=>{if(!when||!timezone)return '';const r=zonedLocalToUtc(when,timezone);return r.ok?`= ${formatInZone(r.utc,'UTC')}`:zoneMessages[r.reason];})();
  const nowMs=new Date(data.now).getTime();
  const active=data.invitations.filter(i=>i.status==='pending'||(i.status==='accepted'&&new Date(i.proposedAt).getTime()>nowMs));
  const history=data.invitations.filter(i=>!active.includes(i));
  const waiting=active.filter(i=>i.myTurn);
  const timeForm=(label:string,go:()=>void,disabled=false)=><div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. Times you enter are read in your profile timezone.</p>}
    <label className="field">Date and time <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    {when&&<p className="fine-print">{preview}</p>}
    <label className="field">Message <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    <button type="button" className="btn primary" disabled={busy||!when||!timezone||disabled} onClick={go}>{label}</button>
  </div>;
  const card=(i:Invitation)=>{
    const events=data.events.filter(e=>e.invitationId===i.id);
    return <div className="sched-card" key={i.id}>
      <p className="friendly-head"><Avatar id={i.otherId} name={i.otherName} version={i.otherAvatar} size={32}/><span><b>{i.direction==='sent'?`You invited ${i.otherName}`:`${i.otherName} invited you`}</b> · {statusText[i.status]??i.status}</span></p>
      <p>{formatInZone(i.proposedAt,zone)} <span className="fine-print">({formatInZone(i.proposedAt,'UTC')})</span></p>
      {i.proposerTimezone!==zone&&<p className="fine-print">Entered as {i.proposedLocal.replace('T',' ')} {i.proposerTimezone}.</p>}
      {i.message&&<p className="fine-print">“{i.message}”</p>}
      {i.status==='pending'&&!i.myTurn&&<p className="fine-print">Waiting for {i.otherName} to answer.</p>}
      <div className="sched-actions">
        {i.status==='pending'&&i.myTurn&&<>
          <button type="button" className="btn primary" disabled={busy} onClick={()=>void send({action:'accept',id:i.id,version:i.version})}>Accept</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>void send({action:'decline',id:i.id,version:i.version})}>Decline</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>{setCounterFor(counterFor===i.id?null:i.id);setWhen('');setMessage('');}}>{counterFor===i.id?'Close counter':'Counter-propose'}</button>
        </>}
        {(i.status==='pending'||i.status==='accepted')&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void send({action:'cancel',id:i.id,version:i.version})}>Cancel</button>}
      </div>
      {counterFor===i.id&&timeForm('Send counter-proposal',()=>void send({action:'counter',id:i.id,version:i.version,local:when,message}))}
      {events.length>0&&<details className="sched-history"><summary>History ({events.length})</summary><ul>{events.map(e=><li key={e.id}><b>{eventText[e.action]??e.action}</b>{e.proposedAt&&<> · {formatInZone(e.proposedAt,zone)}</>} <span className="fine-print">{e.actorName} · {formatInZone(e.at,zone)}{e.reason?` · ${e.reason}`:''}</span></li>)}</ul></details>}
    </div>;
  };
  return <section className="panel friendlies-panel" aria-labelledby="friendlies-heading">
    <h2 id="friendlies-heading">Friendlies</h2>
    <p className="fine-print">Casual matches between two players. They don’t affect Elo, standings, awards or qualification, and need no result or proof. Times show in {zone}.</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {!data.me.eligible?<p className="notice">{data.me.reason??'Friendlies are not available to you yet.'}</p>:<>
      <details className="schedule-editor" open={!data.invitations.length}><summary>Invite a player</summary>
        <label className="field">Player<select value={who} onChange={e=>setWho(e.target.value)}><option value="">Choose a player</option>{data.directory.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {timeForm('Send invitation',()=>void send({action:'invite',inviteeId:who,local:when,message}),!who)}
        <p className="fine-print">Up to {data.me.maxPending} invitations can be waiting at once. Only you and the invited player can see an invitation.</p>
      </details>
      {waiting.length>0&&<><h3>Needs your answer</h3>{waiting.map(card)}</>}
      <h3>Upcoming and waiting</h3>
      {active.filter(i=>!i.myTurn).length?active.filter(i=>!i.myTurn).map(card):<p className="fine-print">No upcoming friendlies.</p>}
      <h3>History</h3>
      {history.length?history.map(card):<p className="fine-print">Nothing here yet.</p>}
    </>}
  </section>;
}

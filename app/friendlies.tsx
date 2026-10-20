'use client';
import {useCallback,useEffect,useState} from 'react';
import {formatInZone,validTimezone,zonedLocalToUtc,zoneMessages} from '@/lib/timezone';
import {api} from './ui';
import {Avatar} from './avatar-picker';

type Invitation={elo?:{state:'counts'|'waiting'|'earlier'|'none';canConfirm:boolean}|null;logged?:boolean;result?:Result|null;id:string;status:string;proposedAt:string;proposedLocal:string;proposerTimezone:string;message:string|null;version:number;direction:'sent'|'received';myTurn:boolean;proposedByMe:boolean;otherName:string;otherId:string;otherAvatar:number|null;firstName?:string;organizerProposal?:boolean;organizerView?:boolean;firstResponse?:boolean;waitingFor?:string|null};
type Ev={id:string;invitationId:string;actorName:string;at:string;action:string;reason:string|null;proposedAt:string|null};
type Side={goals:number;stars:number|null};
type Result={mine:Side;theirs:Side;by:string;at:string};
type Data={unavailable?:{name:string;reason:string}[];now:string;me:{id:string;name:string;eligible:boolean;reason:string|null;timezone:string;maxPending:number;owner?:boolean};invitations:Invitation[];events:Ev[];directory:{id:string;name:string}[]};
const statusText:Record<string,string>={pending:'Waiting for an answer',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};
const eventText:Record<string,string>={logged:'Logged after the fact',invited:'Invited',organized:'Organizer proposed',agreed:'First player accepted',countered:'Counter-proposed',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};

const STAR_OPTIONS=Array.from({length:10},(_,i)=>(i+1)/2);
function ResultBox({inv,busy,onSave}:{inv:Invitation;busy:boolean;onSave:(body:Record<string,unknown>)=>void}){
  const r=inv.result,[open,setOpen]=useState(false),[mine,setMine]=useState(String(r?.mine.goals??'')),[theirs,setTheirs]=useState(String(r?.theirs.goals??''));
  const [ms,setMs]=useState(r?.mine.stars==null?'':String(r.mine.stars)),[ts,setTs]=useState(r?.theirs.stars==null?'':String(r.theirs.stars));
  const num=(x:string)=>x.replace(/\D/g,'').slice(0,2),stars=(x:string)=>x===''?null:Number(x);
  const starPick=(label:string,v:string,set:(x:string)=>void)=><label className="field">{label}<select value={v} onChange={e=>set(e.target.value)}><option value="">Not set</option>{STAR_OPTIONS.map(o=><option key={o} value={o}>{o} ★</option>)}</select></label>;
  const show=(side:Side)=>side.stars==null?'':` (${side.stars} ★)`;
  return <div className="friendly-result">
    {r&&<p className="friendly-score"><b>{inv.organizerView?inv.firstName:'You'} {r.mine.goals}{show(r.mine)} – {r.theirs.goals}{show(r.theirs)} {inv.otherName}</b> <span className="fine-print">entered by {r.by}</span></p>}
    {r&&inv.elo&&<p className={'friendly-elo friendly-elo-'+inv.elo.state}>{inv.elo.state==='counts'?'Counts for Elo (half weight)':inv.elo.state==='waiting'?(inv.elo.canConfirm?`${inv.otherName} entered this score. Confirm it and it counts for Elo.`:`Waiting for ${inv.otherName} to confirm this score. It counts for Elo once they do.`):inv.elo.state==='earlier'?'Played before friendlies counted for Elo':''}</p>}
    {!inv.organizerView&&r&&inv.elo?.canConfirm&&!open&&<button type="button" className="btn primary" disabled={busy} onClick={()=>onSave({action:'result',id:inv.id,myGoals:r.mine.goals,theirGoals:r.theirs.goals,myStars:r.mine.stars,theirStars:r.theirs.stars})}>Confirm score</button>}
    {inv.organizerView?null:!open?<button type="button" className="btn secondary" onClick={()=>setOpen(true)}>{r?'Correct result':'Add result'}</button>:<div className="sched-form">
      <label className="field">Your goals<input inputMode="numeric" maxLength={2} value={mine} onChange={e=>setMine(num(e.target.value))}/></label>
      <label className="field">{inv.otherName}’s goals<input inputMode="numeric" maxLength={2} value={theirs} onChange={e=>setTheirs(num(e.target.value))}/></label>
      {starPick('Your team stars',ms,setMs)}{starPick(`${inv.otherName}’s team stars`,ts,setTs)}
      <button type="button" className="btn primary" disabled={busy||mine===''||theirs===''} onClick={()=>{onSave({action:'result',id:inv.id,myGoals:Number(mine),theirGoals:Number(theirs),myStars:stars(ms),theirStars:stars(ts)});setOpen(false);}}>Save result</button>
      <button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancel</button>
      <p className="fine-print">Counts for Elo at half weight once both players agree on the score. No standings or awards.</p>
    </div>}
  </div>;
}
/** Register a friendly that was already played: no invitation, the score goes in right away. */
function LogForm({data,timezone,onDone}:{data:Data;timezone?:string;onDone:()=>void}){
  const owner=!!data.me.owner,[first,setFirst]=useState(''),[opp,setOpp]=useState(''),[when,setWhen]=useState(''),[mine,setMine]=useState(''),[theirs,setTheirs]=useState('');
  const [ms,setMs]=useState(''),[ts,setTs]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const num=(x:string)=>x.replace(/\D/g,'').slice(0,2),stars=(x:string)=>x===''?null:Number(x);
  const names=new Map(data.directory.map(p=>[p.id,p.name])),firstName=first?names.get(first)??'Player 1':'You',oppName=opp?names.get(opp)??'Opponent':'Opponent';
  const starPick=(label:string,v:string,set:(x:string)=>void)=><label className="field">{label}<select value={v} onChange={e=>set(e.target.value)}><option value="">Not set</option>{STAR_OPTIONS.map(o=><option key={o} value={o}>{o} ★</option>)}</select></label>;
  async function save(){
    setBusy(true);setError('');
    try{await api('friendlies',{action:'log',opponentId:opp,asPlayerId:first||undefined,local:when,myGoals:Number(mine),theirGoals:Number(theirs),myStars:stars(ms),theirStars:stars(ts),message});setFirst('');setOpp('');setWhen('');setMine('');setTheirs('');setMs('');setTs('');setMessage('');onDone();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. The date you enter is read in your profile timezone.</p>}
    {owner&&<label className="field">First player <small>Organizer only. Leave as you to log your own game.</small><select value={first} onChange={e=>{setFirst(e.target.value);setOpp('');}}><option value="">You</option>{data.directory.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className="field">{owner&&first?'Second player':'Played against'}<select value={opp} onChange={e=>setOpp(e.target.value)}><option value="">Choose a player</option>{data.directory.filter(p=>p.id!==first).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">When it was played <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    <label className="field">{firstName==='You'?'Your goals':`${firstName}’s goals`}<input inputMode="numeric" maxLength={2} value={mine} onChange={e=>setMine(num(e.target.value))}/></label>
    <label className="field">{oppName}’s goals<input inputMode="numeric" maxLength={2} value={theirs} onChange={e=>setTheirs(num(e.target.value))}/></label>
    {starPick(firstName==='You'?'Your team stars':`${firstName}’s team stars`,ms,setMs)}{starPick(`${oppName}’s team stars`,ts,setTs)}
    <label className="field">Note <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button type="button" className="btn primary" disabled={busy||!opp||!when||!timezone||mine===''||theirs===''} onClick={()=>void save()}>{busy?'Saving…':'Save played friendly'}</button>
    <p className="fine-print">For a game that is already over. It shows in both players’ history and counts for Elo at half weight once the other player confirms the score. Either player can correct the score later.</p>
  </div>;
}
function OrganizeForm({data,timezone,onDone}:{data:Data;timezone?:string;onDone:()=>void}){
  const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[when,setWhen]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const preview=when&&timezone?(()=>{const r=zonedLocalToUtc(when,timezone);return r.ok?`= ${formatInZone(r.utc,'UTC')}`:zoneMessages[r.reason];})():'';
  async function save(){
    setBusy(true);setError('');
    try{
      await api('friendlies',{action:'organize',firstId:first||data.me.id,secondId:second,local:when,message});
      setFirst('');setSecond('');setWhen('');setMessage('');onDone();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. Times you enter are read in your profile timezone.</p>}
    <label className="field">First player<select value={first} onChange={e=>{setFirst(e.target.value);setSecond('');}}><option value="">You</option>{data.directory.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">Second player<select value={second} onChange={e=>setSecond(e.target.value)}><option value="">Choose a player</option>{data.directory.filter(p=>p.id!==first).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">Date and time <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    {preview&&<p className="fine-print">{preview}</p>}
    <label className="field">Message <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button type="button" className="btn primary" disabled={busy||!second||!when||!timezone} onClick={()=>void save()}>{busy?'Sending…':'Ask both players to accept'}</button>
    <p className="fine-print">Both players see this proposal. The first player answers, then the second. It appears as confirmed only after both accept the same time.</p>
  </div>;
}
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
      <p className="friendly-head"><Avatar id={i.otherId} name={i.otherName} version={i.otherAvatar} size={32}/><span><b>{i.organizerView?`${i.firstName} vs ${i.otherName}`:i.organizerProposal?`Organizer arranged your friendly with ${i.otherName}`:i.logged?(i.proposedByMe?`Played with ${i.otherName}`:`${i.otherName} logged a game with you`):i.direction==='sent'?`You invited ${i.otherName}`:`${i.otherName} invited you`}</b> · {i.status==='cancelled'?'Cancelled':i.logged?'Logged after the fact':statusText[i.status]??i.status}</span></p>
      <p>{formatInZone(i.proposedAt,zone)} <span className="fine-print">({formatInZone(i.proposedAt,'UTC')})</span></p>
      {i.proposerTimezone!==zone&&<p className="fine-print">Entered as {i.proposedLocal.replace('T',' ')} {i.proposerTimezone}.</p>}
      {i.message&&<p className="fine-print">“{i.message}”</p>}
      {i.organizerProposal&&i.status==='pending'&&i.myTurn&&!i.firstResponse&&<p className="fine-print">Accepting sends this time to {i.otherName} for their approval. The match is not confirmed yet.</p>}
      {i.status==='pending'&&!i.myTurn&&<p className="fine-print">Waiting for {i.waitingFor||i.otherName} to answer.{i.organizerProposal&&!i.firstResponse?' Both players must accept.':''}</p>}
      <div className="sched-actions">
        {i.status==='pending'&&i.myTurn&&<>
          <button type="button" className="btn primary" disabled={busy} onClick={()=>void send({action:'accept',id:i.id,version:i.version})}>Accept</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>void send({action:'decline',id:i.id,version:i.version})}>Decline</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={()=>{setCounterFor(counterFor===i.id?null:i.id);setWhen('');setMessage('');}}>{counterFor===i.id?'Close counter':'Counter-propose'}</button>
        </>}
        {(i.status==='pending'||(i.status==='accepted'&&(data.me.owner||new Date(i.proposedAt).getTime()>nowMs)))&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>{
          const played=i.status==='accepted'&&new Date(i.proposedAt).getTime()<=nowMs;
          if(played){const reason=window.prompt(`Cancel the played friendly ${i.firstName} vs ${i.otherName}? Its score will stop counting toward Elo. Enter a reason:`);if(!reason||reason.trim().length<3)return;void send({action:'cancel',id:i.id,version:i.version,message:reason.trim()});}
          else if(window.confirm(`Cancel this friendly between ${i.firstName} and ${i.otherName}?`))void send({action:'cancel',id:i.id,version:i.version});
        }}>{i.status==='accepted'&&new Date(i.proposedAt).getTime()<=nowMs?'Void played match':'Cancel'}</button>}
      </div>
      {i.status==='accepted'&&new Date(i.proposedAt).getTime()<=nowMs&&<ResultBox key={i.id+(i.result?.at??'')} inv={i} busy={busy} onSave={body=>void send(body)}/>}
      {i.status==='cancelled'&&i.result&&<p className="fine-print">Voided result: {i.organizerView?i.firstName:'You'} {i.result.mine.goals}–{i.result.theirs.goals} {i.otherName}. It no longer counts toward Elo.</p>}
      {counterFor===i.id&&timeForm('Send counter-proposal',()=>void send({action:'counter',id:i.id,version:i.version,local:when,message}))}
      {events.length>0&&<details className="sched-history"><summary>History ({events.length})</summary><ul>{events.map(e=><li key={e.id}><b>{eventText[e.action]??e.action}</b>{e.proposedAt&&<> · {formatInZone(e.proposedAt,zone)}</>} <span className="fine-print">{e.actorName} · {formatInZone(e.at,zone)}{e.reason?` · ${e.reason}`:''}</span></li>)}</ul></details>}
    </div>;
  };
  return <section className="panel friendlies-panel" aria-labelledby="friendlies-heading">
    <h2 id="friendlies-heading" className="visually-hidden">Friendlies</h2>
    <p className="fine-print">Casual matches between two players. After you play, add the score and each team’s stars. Once both players agree on the score it counts for Elo at half weight. No standings, awards or proof. Times show in {zone}.{data.me.owner?' As organizer, you can see every friendly and void a played match with a reason.':''}</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {!data.me.eligible?<p className="notice">{data.me.reason??'Friendlies are not available to you yet.'}</p>:<>
      <details className="schedule-editor" open={!data.invitations.length}><summary>Invite a player</summary>
        {!data.directory.length&&<div className="notice"><p><b>No one is available to invite yet.</b></p>{data.unavailable?.length?<ul>{data.unavailable.map(u=><li key={u.name}><b>{u.name}</b>: {u.reason}</li>)}</ul>:<p className="fine-print">Other players show up here once they have a finished profile (username, platform, timezone and an in-game ID).</p>}</div>}
        <label className="field">Player<select value={who} onChange={e=>setWho(e.target.value)}><option value="">Choose a player</option>{data.directory.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {timeForm('Send invitation',()=>void send({action:'invite',inviteeId:who,local:when,message}),!who)}
        <p className="fine-print">Up to {data.me.maxPending} invitations can be waiting at once. Only you and the invited player can see an invitation.</p>
      </details>
      {data.me.owner&&<details className="schedule-editor"><summary>Arrange a friendly for two players</summary><OrganizeForm data={data} timezone={timezone} onDone={()=>void load()}/></details>}
      <details className="schedule-editor"><summary>Log a game you already played</summary><LogForm data={data} timezone={timezone} onDone={()=>void load()}/></details>
      {waiting.length>0&&<><h3>Needs your answer</h3>{waiting.map(card)}</>}
      <h3>Upcoming and waiting</h3>
      {active.filter(i=>!i.myTurn).length?active.filter(i=>!i.myTurn).map(card):<p className="fine-print">No upcoming friendlies.</p>}
      <h3>History</h3>
      {history.length?history.map(card):<p className="fine-print">Nothing here yet.</p>}
    </>}
  </section>;
}

'use client';
import {useCallback,useEffect,useState} from 'react';
import type {Fixture} from '@/lib/domain';
import {formatInZone,validTimezone,zonedLocalToUtc,zoneMessages} from '@/lib/timezone';
import {api,type Member} from './ui';

export type Proposal={id:string;fixture_id:string;kind:string;proposed_at:string;proposed_local:string;proposer_timezone:string;proposer_name:string;proposer_side:'home'|'away';responder_side:'home'|'away';message:string|null;status:string;beyond_deadline:number;decided_reason:string|null;created_at:string;version:number};
type Ev={id:string;fixture_id:string;actor_name:string;at:string;action:string;reason:string|null;kickoff_before:string|null;kickoff_after:string|null;proposed_at:string|null};
export type ScheduleState={now:string;settings:{booking_minutes:number|null;season_start:string|null;season_end:string|null;version:number};windows:{id:string;matchday:number|null;fixture_id:string|null;opens_at:string|null;deadline_at:string|null;version:number}[];proposals:Proposal[];events:Ev[];sides:Record<string,'home'|'away'|null>};
const eventLabels:Record<string,string>={proposed:'Proposed a kickoff',countered:'Counter-proposed',accepted:'Opponent accepted — kickoff confirmed','opponent-agreed':'Opponent agreed — waiting for the owner',declined:'Declined',withdrawn:'Withdrawn','owner-approved':'Owner approved — kickoff confirmed','owner-rejected':'Owner rejected',superseded:'Closed — kickoff changed',expired:'Expired'};
/** The viewer's own timezone for display: the saved profile zone, else this browser's. */
export const viewerZone=(saved?:string)=>saved&&validTimezone(saved)?saved:Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function MatchScheduling({fixture:f,tid,member,timezone,onSaved}:{fixture:Fixture;tid:string;member:Member;timezone?:string;onSaved:()=>Promise<void>}){
  const [data,setData]=useState<ScheduleState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[when,setWhen]=useState(''),[message,setMessage]=useState(''),[reason,setReason]=useState(''),[counter,setCounter]=useState(false);
  const zone=viewerZone(timezone),endpoint=`tournament/${tid}/fixture/${f.id}/scheduling`;
  const load=useCallback(async()=>{try{setData(await api<ScheduleState>(`tournament/${tid}/schedule`));}catch(e){setError((e as Error).message);}},[tid]);
  useEffect(()=>{void load();},[load]);
  if(!data)return error?<p className="inline-error" role="alert">{error}</p>:null;
  const side=data.sides[f.id]??null,admin=member.role==='admin',mine=data.proposals.filter(p=>p.fixture_id===f.id),active=mine.find(p=>p.status==='awaiting_opponent'||p.status==='awaiting_owner'),events=data.events.filter(e=>e.fixture_id===f.id);
  const win=data.windows.find(w=>w.fixture_id===f.id)??(f.kind==='club'&&f.stage==='league'?data.windows.find(w=>!w.fixture_id&&w.matchday===f.matchday):undefined);
  const open=f.status==='scheduled'&&(side||admin);
  async function send(body:Record<string,unknown>,after?:()=>void){
    setBusy(true);setError('');
    try{await api(endpoint,body);after?.();setMessage('');setReason('');setWhen('');setCounter(false);await load();await onSaved();}
    catch(e){setError((e as Error).message);await load();}finally{setBusy(false);}
  }
  const preview=(()=>{if(!when)return '';const r=zonedLocalToUtc(when,timezone&&validTimezone(timezone)?timezone:'');return r.ok?`= ${formatInZone(r.utc,'UTC')}`:zoneMessages[r.reason];})();
  const timeForm=(label:string,go:()=>void)=><div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. Times you enter are read in your profile timezone.</p>}
    <label className="field">Kickoff <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    {when&&<p className="fine-print">{preview}</p>}
    <label className="field">Message <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    <button type="button" className="btn primary" disabled={busy||!when||!timezone} onClick={go}>{label}</button>
  </div>;
  return <section className="schedule-panel" aria-label="Kickoff scheduling">
    <h3>Kickoff</h3>
    <p>{f.scheduled?<><b>{formatInZone(f.scheduled,zone)}</b> <span className="fine-print">({formatInZone(f.scheduled,'UTC')})</span></>:'No kickoff agreed yet.'}</p>
    <p className="fine-print">Times show in {zone}. The match window and deadline are set by the owner{win?.deadline_at?<>; deadline <b>{formatInZone(win.deadline_at,zone)}</b></>:' (no deadline set)'}{win?.opens_at?<>; opens {formatInZone(win.opens_at,zone)}</>:null}. An agreed kickoff stays in place until a replacement is accepted.</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {active&&<div className="sched-card">
      <p><b>{active.proposer_name}</b> {active.kind==='counter'?'counter-proposed':'proposed'} <b>{formatInZone(active.proposed_at,zone)}</b>{active.proposer_timezone!==zone&&<span className="fine-print"> (they entered {active.proposed_local.replace('T',' ')} {active.proposer_timezone})</span>}</p>
      {active.message&&<p className="fine-print">“{active.message}”</p>}
      {active.beyond_deadline===1&&<p className="notice warning">This is past the owner’s deadline. {active.status==='awaiting_owner'?'Your opponent agreed; the owner must approve it with a reason.':'It needs your opponent’s agreement and then the owner’s approval.'}</p>}
      {active.status==='awaiting_opponent'&&open&&side===active.responder_side&&<div className="sched-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={()=>void send({action:'accept',proposalId:active.id,version:active.version})}>Accept this time</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>void send({action:'decline',proposalId:active.id,version:active.version})}>Decline</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>setCounter(!counter)}>{counter?'Cancel counter':'Counter-propose'}</button>
        {counter&&timeForm('Send counter-proposal',()=>void send({action:'counter',proposalId:active.id,version:active.version,local:when,message}))}
      </div>}
      {active.status==='awaiting_opponent'&&side===active.responder_side&&!open&&null}
      {active.status==='awaiting_opponent'&&side===active.proposer_side&&<p className="fine-print">Waiting for your opponent to respond.</p>}
      {active.status==='awaiting_owner'&&admin&&<div className="sched-actions">
        <label className="field">Reason <small>Required</small><input maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button type="button" className="btn primary" disabled={busy||reason.trim().length<3} onClick={()=>void send({action:'approve',proposalId:active.id,version:active.version,reason})}>Approve beyond deadline</button>
        <button type="button" className="btn secondary" disabled={busy||reason.trim().length<3} onClick={()=>void send({action:'reject',proposalId:active.id,version:active.version,reason})}>Reject</button>
      </div>}
      {active.status==='awaiting_owner'&&!admin&&<p className="fine-print">Waiting for the owner’s decision.</p>}
      {open&&(side===active.proposer_side||admin)&&<div className="sched-actions">
        {!(side===active.proposer_side)&&<label className="field">Reason for withdrawing <small>Required for the owner</small><input maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
        <button type="button" className="btn secondary" disabled={busy||(side!==active.proposer_side&&reason.trim().length<3)} onClick={()=>void send({action:'withdraw',proposalId:active.id,version:active.version,reason})}>Withdraw proposal</button>
      </div>}
    </div>}
    {open&&side&&!active&&<details className="schedule-editor"><summary>{f.scheduled?'Propose a new kickoff':'Propose a kickoff'}</summary>
      {timeForm('Send proposal',()=>void send({action:'propose',fixtureVersion:f.version,baseKickoff:f.scheduled,local:when,message}))}
    </details>}
    {data.settings.booking_minutes==null&&<p className="fine-print">The owner has not set a booking length yet, so only identical start times are checked for clashes.</p>}
    {events.length>0&&<details className="sched-history"><summary>Scheduling history ({events.length})</summary><ul>{events.map(e=><li key={e.id}><b>{eventLabels[e.action]??e.action}</b>{e.proposed_at&&<> · {formatInZone(e.proposed_at,zone)}</>} <span className="fine-print">{e.actor_name} · {formatInZone(e.at,zone)}{e.reason?` · ${e.reason}`:''}</span></li>)}</ul></details>}
  </section>;
}

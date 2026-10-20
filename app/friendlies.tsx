'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,CalendarPlus,ClipboardCheck,Clock3,Gamepad2,History,Plus,Swords,Users,X} from 'lucide-react';
import {formatInZone,validTimezone,zonedLocalToUtc,utcToZonedLocal,zoneMessages} from '@/lib/timezone';
import {api} from './ui';
import {Avatar} from './avatar-picker';
import {viewHref} from './ugs-navigation';

type Invitation={elo?:{state:'counts'|'waiting'|'earlier'|'none';canConfirm:boolean}|null;logged?:boolean;ratingIssue?:string|null;result?:Result|null;id:string;status:string;mode:'clubs'|'ultimate';proposedAt:string;proposedLocal:string;proposerTimezone:string;message:string|null;version:number;direction:'sent'|'received';myTurn:boolean;proposedByMe:boolean;otherName:string;otherId:string;otherAvatar:number|null;firstId:string;secondId:string;firstName:string;secondName:string;firstAvatar:number|null;secondAvatar:number|null;organizerProposal?:boolean;organizerView?:boolean;firstResponse?:boolean;waitingFor?:string|null};
type Ev={id:string;invitationId:string;actorName:string;at:string;action:string;reason:string|null;proposedAt:string|null};
type Side={goals:number;stars:number|null};
type Result={mine:Side;theirs:Side;first:Side;second:Side;by:string;at:string};
type DirectoryPlayer={id:string;name:string;ranked:boolean;eligible:boolean;reason:string|null};
type Data={unavailable?:{name:string;reason:string}[];unlinkedProfiles?:{id:string;name:string}[];now:string;me:{id:string;name:string;eligible:boolean;reason:string|null;timezone:string;maxPending:number;owner?:boolean;ranked:boolean};invitations:Invitation[];events:Ev[];directory:DirectoryPlayer[]};
const statusText:Record<string,string>={pending:'Waiting for an answer',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};
const eventText:Record<string,string>={logged:'Logged after the fact',reassigned:'Players corrected',corrected:'Result corrected',invited:'Invited',organized:'Organizer proposed',agreed:'First player accepted',countered:'Counter-proposed',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',expired:'Expired'};

const STAR_OPTIONS=[3.5,4,4.5,5];
const starsWithLegacy=(current:number|null|undefined)=>current!=null&&current<3.5?[current,...STAR_OPTIONS]:STAR_OPTIONS;
const formatLabel=(mode:'clubs'|'ultimate')=>mode==='ultimate'?'Ultimate Team':'Clubs';
function LinkAccountForm({person,data,onDone}:{person:DirectoryPlayer;data:Data;onDone:()=>void}){
  const [choice,setChoice]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function link(){setBusy(true);setError('');try{await api('friendlies',{action:'link-player',accountId:person.id,...(choice==='new'?{create:true}:{playerId:choice})});onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="notice warning"><b>{person.name} needs an Elo player link.</b><p className="fine-print">Choose the existing player profile to keep their match history, or create one if this player is new.</p>
    <label className="field">Elo player<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Choose a profile</option>{data.unlinkedProfiles?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="new">Create new profile for {person.name}</option></select></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button type="button" className="btn secondary" disabled={busy||!choice} onClick={()=>void link()}>{busy?'Linking…':'Link player to Elo'}</button>
  </div>;
}
function ResultBox({inv,busy,onSave}:{inv:Invitation;busy:boolean;onSave:(body:Record<string,unknown>)=>void}){
  const r=inv.result,[open,setOpen]=useState(false),[mine,setMine]=useState(String(r?.mine.goals??'')),[theirs,setTheirs]=useState(String(r?.theirs.goals??''));
  const [ms,setMs]=useState(r?.mine.stars==null?'':String(r.mine.stars)),[ts,setTs]=useState(r?.theirs.stars==null?'':String(r.theirs.stars));
  const num=(x:string)=>x.replace(/\D/g,'').slice(0,2),stars=(x:string)=>x===''?null:Number(x);
  const starPick=(label:string,v:string,set:(x:string)=>void,current:number|null|undefined)=><label className="field">{label}<select value={v} onChange={e=>set(e.target.value)}><option value="">Not set</option>{starsWithLegacy(current).map(o=><option key={o} value={o}>{o} ★{o<3.5?' · previous rating':''}</option>)}</select></label>;
  const show=(side:Side)=>side.stars==null?'':` (${side.stars} ★)`;
  return <div className="friendly-result">
    {r&&<p className="friendly-score"><b>{inv.organizerView?inv.firstName:'You'} {r.mine.goals}{show(r.mine)} – {r.theirs.goals}{show(r.theirs)} {inv.otherName}</b> <span className="fine-print">entered by {r.by}</span></p>}
    {r&&inv.ratingIssue?<p className="notice warning">{inv.ratingIssue}</p>:r&&inv.elo&&<p className={'friendly-elo friendly-elo-'+inv.elo.state}>{inv.elo.state==='counts'?'Counts for Elo (half weight)':inv.elo.state==='waiting'?(inv.elo.canConfirm?`${inv.otherName} entered this score. Confirm it and it counts for Elo.`:`Waiting for ${inv.otherName} to confirm this score. It counts for Elo once they do.`):inv.elo.state==='earlier'?'Played before friendlies counted for Elo':''}</p>}
    {!inv.organizerView&&r&&inv.elo?.canConfirm&&!open&&<button type="button" className="btn primary" disabled={busy} onClick={()=>onSave({action:'result',id:inv.id,myGoals:r.mine.goals,theirGoals:r.theirs.goals,myStars:r.mine.stars,theirStars:r.theirs.stars})}>Confirm score</button>}
    {inv.organizerView?null:!open?<button type="button" className="btn secondary" onClick={()=>setOpen(true)}>{r?'Correct result':'Add result'}</button>:<div className="sched-form">
      <label className="field">Your goals<input inputMode="numeric" maxLength={2} value={mine} onChange={e=>setMine(num(e.target.value))}/></label>
      <label className="field">{inv.otherName}’s goals<input inputMode="numeric" maxLength={2} value={theirs} onChange={e=>setTheirs(num(e.target.value))}/></label>
      {inv.mode==='clubs'&&<>{starPick('Your team stars',ms,setMs,r?.mine.stars)}{starPick(`${inv.otherName}’s team stars`,ts,setTs,r?.theirs.stars)}</>}
      <button type="button" className="btn primary" disabled={busy||mine===''||theirs===''} onClick={()=>{onSave({action:'result',id:inv.id,myGoals:Number(mine),theirGoals:Number(theirs),myStars:inv.mode==='clubs'?stars(ms):null,theirStars:inv.mode==='clubs'?stars(ts):null});setOpen(false);}}>Save result</button>
      <button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancel</button>
      <p className="fine-print">Counts for Elo at half weight once both players agree on the score. No standings or awards.</p>
    </div>}
  </div>;
}
function AdminResultEditor({inv,timezone,busy,onSave}:{inv:Invitation;timezone:string;busy:boolean;onSave:(body:Record<string,unknown>)=>void}){
  const [when,setWhen]=useState(utcToZonedLocal(inv.proposedAt,timezone));
  const [firstGoals,setFirstGoals]=useState(String(inv.result?.first.goals??'')),[secondGoals,setSecondGoals]=useState(String(inv.result?.second.goals??''));
  const [firstStars,setFirstStars]=useState(inv.result?.first.stars==null?'':String(inv.result.first.stars)),[secondStars,setSecondStars]=useState(inv.result?.second.stars==null?'':String(inv.result.second.stars));
  const [reason,setReason]=useState('');
  const number=(value:string)=>value.replace(/\D/g,'').slice(0,2);
  return <details className="schedule-editor admin-friendly-edit"><summary>{inv.result?'Edit result and date':'Add result'}</summary><div className="sched-form">
    <label className="field">Played at <small>{timezone}</small><input type="datetime-local" value={when} onChange={event=>setWhen(event.target.value)} disabled={busy}/></label>
    <label className="field">{inv.firstName} goals<input inputMode="numeric" maxLength={2} value={firstGoals} onChange={event=>setFirstGoals(number(event.target.value))} disabled={busy}/></label>
    <label className="field">{inv.secondName} goals<input inputMode="numeric" maxLength={2} value={secondGoals} onChange={event=>setSecondGoals(number(event.target.value))} disabled={busy}/></label>
    {inv.mode==='clubs'&&<><label className="field">{inv.firstName} team stars<select value={firstStars} onChange={event=>setFirstStars(event.target.value)} disabled={busy}><option value="">Not set</option>{starsWithLegacy(inv.result?.first.stars).map(stars=><option value={stars} key={stars}>{stars} ★{stars<3.5?' · previous rating':''}</option>)}</select></label>
    <label className="field">{inv.secondName} team stars<select value={secondStars} onChange={event=>setSecondStars(event.target.value)} disabled={busy}><option value="">Not set</option>{starsWithLegacy(inv.result?.second.stars).map(stars=><option value={stars} key={stars}>{stars} ★{stars<3.5?' · previous rating':''}</option>)}</select></label></>}
    <label className="field">Reason for change<input value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} placeholder="What needed correction?" disabled={busy}/></label>
    <button type="button" className="btn primary" disabled={busy||!when||firstGoals===''||secondGoals===''||reason.trim().length<3} onClick={()=>onSave({action:'admin-result',id:inv.id,version:inv.version,local:when,firstGoals:Number(firstGoals),secondGoals:Number(secondGoals),firstStars:inv.mode==='clubs'&&firstStars!==''?Number(firstStars):null,secondStars:inv.mode==='clubs'&&secondStars!==''?Number(secondStars):null,reason:reason.trim()})}>Save correction</button>
  </div></details>;
}
/** Register a friendly that was already played: no invitation, the score goes in right away. */
function LogForm({data,timezone,onDone}:{data:Data;timezone?:string;onDone:()=>void}){
  const owner=!!data.me.owner,[first,setFirst]=useState(''),[opp,setOpp]=useState(''),[when,setWhen]=useState(''),[mine,setMine]=useState(''),[theirs,setTheirs]=useState(''),[gameMode,setGameMode]=useState<'clubs'|'ultimate'>('clubs');
  const [ms,setMs]=useState(''),[ts,setTs]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const num=(x:string)=>x.replace(/\D/g,'').slice(0,2),stars=(x:string)=>x===''?null:Number(x);
  const choices=owner?data.directory:data.directory.filter(p=>p.eligible),names=new Map(data.directory.map(p=>[p.id,p.name])),firstName=first?names.get(first)??'Player 1':'You',oppName=opp?names.get(opp)??'Opponent':'Opponent';
  const firstAccount=data.directory.find(p=>p.id===first),oppAccount=data.directory.find(p=>p.id===opp),missingLink=[firstAccount,oppAccount].filter((p):p is DirectoryPlayer=>!!p&&!p.ranked);
  const starPick=(label:string,v:string,set:(x:string)=>void)=><label className="field">{label}<select value={v} onChange={e=>set(e.target.value)}><option value="">Not set</option>{STAR_OPTIONS.map(o=><option key={o} value={o}>{o} ★</option>)}</select></label>;
  async function save(){
    setBusy(true);setError('');
    try{await api('friendlies',{action:'log',opponentId:opp,asPlayerId:first||undefined,local:when,mode:gameMode,myGoals:Number(mine),theirGoals:Number(theirs),myStars:gameMode==='clubs'?stars(ms):null,theirStars:gameMode==='clubs'?stars(ts):null,message});setFirst('');setOpp('');setWhen('');setMine('');setTheirs('');setMs('');setTs('');setMessage('');onDone();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. The date you enter is read in your profile timezone.</p>}
    <label className="field">Game mode<select value={gameMode} onChange={e=>setGameMode(e.target.value as 'clubs'|'ultimate')}><option value="clubs">Clubs</option><option value="ultimate">Ultimate Team</option></select></label>
    {owner&&<label className="field">First player <small>{data.me.ranked?'Leave as you to log your own game.':'Your admin account has no linked Elo player; choose your separate player account.'}</small><select value={first} onChange={e=>{setFirst(e.target.value);setOpp('');}}><option value="">{data.me.ranked?'You':'Choose a player'}</option>{choices.map(p=><option key={p.id} value={p.id}>{p.name}{p.ranked?'':' · Link for Elo'}</option>)}</select></label>}
    <label className="field">{owner&&first?'Second player':'Played against'}<select value={opp} onChange={e=>setOpp(e.target.value)}><option value="">Choose a player</option>{choices.filter(p=>p.id!==first).map(p=><option key={p.id} value={p.id}>{p.name}{p.ranked?'':' · Link for Elo'}</option>)}</select></label>
    {owner&&missingLink.map(p=><LinkAccountForm key={p.id} person={p} data={data} onDone={onDone}/>)}
    <label className="field">When it was played <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    <label className="field">{firstName==='You'?'Your goals':`${firstName}’s goals`}<input inputMode="numeric" maxLength={2} value={mine} onChange={e=>setMine(num(e.target.value))}/></label>
    <label className="field">{oppName}’s goals<input inputMode="numeric" maxLength={2} value={theirs} onChange={e=>setTheirs(num(e.target.value))}/></label>
    {gameMode==='clubs'&&<>{starPick(firstName==='You'?'Your team stars':`${firstName}’s team stars`,ms,setMs)}{starPick(`${oppName}’s team stars`,ts,setTs)}</>}
    <label className="field">Note <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button type="button" className="btn primary" disabled={busy||!opp||!when||!timezone||mine===''||theirs===''||missingLink.length>0||(owner&&!data.me.ranked&&!first)||(!owner&&!data.me.ranked)} onClick={()=>void save()}>{busy?'Saving…':'Save played friendly'}</button>
    <p className="fine-print">For a game that is already over. It shows in both players’ history and counts for Elo at half weight once the other player confirms the score. Either player can correct the score later.</p>
  </div>;
}
function OrganizeForm({data,timezone,onDone}:{data:Data;timezone?:string;onDone:()=>void}){
  const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[when,setWhen]=useState(''),[message,setMessage]=useState(''),[gameMode,setGameMode]=useState<'clubs'|'ultimate'>('clubs');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const eligible=data.directory.filter(p=>p.eligible);
  const preview=when&&timezone?(()=>{const r=zonedLocalToUtc(when,timezone);return r.ok?`= ${formatInZone(r.utc,'UTC')}`:zoneMessages[r.reason];})():'';
  async function save(){
    setBusy(true);setError('');
    try{
      await api('friendlies',{action:'organize',firstId:first||data.me.id,secondId:second,local:when,mode:gameMode,message});
      setFirst('');setSecond('');setWhen('');setMessage('');onDone();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="sched-form">
    {!timezone&&<p className="notice warning">Set your timezone in My Profile first. Times you enter are read in your profile timezone.</p>}
    <label className="field">Game mode<select value={gameMode} onChange={e=>setGameMode(e.target.value as 'clubs'|'ultimate')}><option value="clubs">Clubs</option><option value="ultimate">Ultimate Team</option></select></label>
    <label className="field">First player<select value={first} onChange={e=>{setFirst(e.target.value);setSecond('');}}><option value="">You</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">Second player<select value={second} onChange={e=>setSecond(e.target.value)}><option value="">Choose a player</option>{eligible.filter(p=>p.id!==first).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="field">Date and time <small>{timezone||'no timezone saved'} · local time</small><input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
    {preview&&<p className="fine-print">{preview}</p>}
    <label className="field">Message <small>Optional</small><input maxLength={500} value={message} onChange={e=>setMessage(e.target.value)}/></label>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <button type="button" className="btn primary" disabled={busy||!second||!when||!timezone} onClick={()=>void save()}>{busy?'Sending…':'Ask both players to accept'}</button>
    <p className="fine-print">Both players see this proposal. The first player answers, then the second. It appears as confirmed only after both accept the same time.</p>
  </div>;
}
function CorrectLoggedPlayers({inv,data,busy,onSave,onLinked}:{inv:Invitation;data:Data;busy:boolean;onSave:(body:Record<string,unknown>)=>void;onLinked:()=>void}){
  const [first,setFirst]=useState(inv.firstId===data.me.id?(data.me.ranked?data.me.id:''):inv.firstId),[second,setSecond]=useState(inv.secondId),[reason,setReason]=useState('');
  const options=[...(data.me.ranked?[{id:data.me.id,name:'You',ranked:true,eligible:true,reason:null}]:[]),...data.directory];
  const missingLink=[data.directory.find(p=>p.id===first),data.directory.find(p=>p.id===second)].filter((p):p is DirectoryPlayer=>!!p&&!p.ranked);
  return <details className="schedule-editor"><summary>Change players</summary><div className="sched-form">
    <p className="fine-print">Correct either player without swapping their score. The change is recorded in this game’s activity.</p>
    <label className="field">First player<select value={first} onChange={e=>setFirst(e.target.value)}><option value="">Choose a player</option>{options.map(p=><option key={p.id} value={p.id}>{p.name}{p.ranked?'':' · Link for Elo'}</option>)}</select></label>
    <label className="field">Second player<select value={second} onChange={e=>setSecond(e.target.value)}><option value="">Choose a player</option>{options.filter(p=>p.id!==first).map(p=><option key={p.id} value={p.id}>{p.name}{p.ranked?'':' · Link for Elo'}</option>)}</select></label>
    {missingLink.map(p=><LinkAccountForm key={p.id} person={p} data={data} onDone={onLinked}/>)}
    <label className="field">Reason<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why are these players being corrected?"/></label>
    <button type="button" className="btn primary" disabled={busy||!first||!second||first===second||missingLink.length>0||reason.trim().length<3||(first===inv.firstId&&second===inv.secondId)} onClick={()=>onSave({action:'reassign',id:inv.id,version:inv.version,firstId:first,secondId:second,reason:reason.trim()})}>Save player correction</button>
  </div></details>;
}
export default function Friendlies({timezone,mode='active'}:{timezone?:string;mode?:'active'|'history'}){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [who,setWho]=useState(''),[when,setWhen]=useState(''),[message,setMessage]=useState(''),[gameMode,setGameMode]=useState<'clubs'|'ultimate'>('clubs'),[counterFor,setCounterFor]=useState<string|null>(null);
  const [activeAction,setActiveAction]=useState<'invite'|'organize'|'log'|null>(null),[matchFilter,setMatchFilter]=useState<'all'|'clubs'|'ultimate'>('all');
  const actionPanelRef=useRef<HTMLDivElement>(null);
  const [historyQuery,setHistoryQuery]=useState(''),[historyFilter,setHistoryFilter]=useState<'played'|'needs-score'|'voided'|'all'>('played');
  const zone=timezone&&validTimezone(timezone)?timezone:Intl.DateTimeFormat().resolvedOptions().timeZone;
  const load=useCallback(async()=>{try{setData(await api<Data>('friendlies'));}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(activeAction)actionPanelRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[activeAction]);
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
      <p className="friendly-head"><Avatar id={i.otherId} name={i.otherName} version={i.otherAvatar} size={32}/><span><b>{i.organizerView?`${i.firstName} vs ${i.otherName}`:i.organizerProposal?`Organizer arranged your friendly with ${i.otherName}`:i.logged?(i.proposedByMe?`Played with ${i.otherName}`:`${i.otherName} logged a game with you`):i.direction==='sent'?`You invited ${i.otherName}`:`${i.otherName} invited you`}</b> · {formatLabel(i.mode)} · {i.status==='cancelled'?'Cancelled':i.logged?'Logged after the fact':statusText[i.status]??i.status}</span></p>
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
      {data.me.owner&&i.logged&&i.status==='accepted'&&<CorrectLoggedPlayers key={i.id+':'+i.version} inv={i} data={data} busy={busy} onSave={body=>void send(body)} onLinked={()=>void load()}/>}
      {i.status==='cancelled'&&i.result&&<p className="fine-print">Voided result: {i.organizerView?i.firstName:'You'} {i.result.mine.goals}–{i.result.theirs.goals} {i.otherName}. It no longer counts toward Elo.</p>}
      {counterFor===i.id&&timeForm('Send counter-proposal',()=>void send({action:'counter',id:i.id,version:i.version,local:when,message}))}
      {mode==='history'&&events.length>0&&<details className="sched-history"><summary>Activity ({events.length})</summary><ul>{events.map(e=><li key={e.id}><b>{eventText[e.action]??e.action}</b>{e.proposedAt&&<> · {formatInZone(e.proposedAt,zone)}</>} <span className="fine-print">{e.actorName} · {formatInZone(e.at,zone)}{e.reason?` · ${e.reason}`:''}</span></li>)}</ul></details>}
    </div>;
  };
  if(mode==='history'&&data.me.owner){
    const counts={played:history.filter(i=>i.status==='accepted'&&!!i.result).length,'needs-score':history.filter(i=>i.status==='accepted'&&!i.result).length,voided:history.filter(i=>i.status==='cancelled'&&!!i.result).length,all:history.length};
    const matches=history.filter(i=>`${i.firstName} ${i.secondName}`.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase()))
      .filter(i=>historyFilter==='all'||historyFilter==='played'&&i.status==='accepted'&&!!i.result||historyFilter==='needs-score'&&i.status==='accepted'&&!i.result||historyFilter==='voided'&&i.status==='cancelled'&&!!i.result)
      .sort((a,b)=>new Date(b.proposedAt).getTime()-new Date(a.proposedAt).getTime());
    const activity=(i:Invitation)=>data.events.filter(e=>e.invitationId===i.id);
    return <section className="panel friendlies-panel admin-friendlies-history" aria-labelledby="friendly-history-heading">
      <h2 id="friendly-history-heading">Friendly match history</h2>
      <p className="fine-print">Review every game, correct its players, score, stars or date, and void an incorrect result. Changes to rated matches update Elo.</p>
      {error&&<p className="inline-error" role="alert">{error}</p>}
      <div className="admin-friendly-toolbar"><label className="field">Find a match<input type="search" value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search either player"/></label><div className="admin-friendly-filters" role="group" aria-label="Match status">{([['played','Played'],['needs-score','Needs score'],['voided','Voided'],['all','All']] as const).map(([key,label])=><button key={key} type="button" className={'btn '+(historyFilter===key?'primary':'secondary')} aria-pressed={historyFilter===key} onClick={()=>setHistoryFilter(key)}>{label} <span>{counts[key]}</span></button>)}</div></div>
      {matches.length?<div className="admin-friendly-list">{matches.map(i=>{const events=activity(i),rated=i.status==='cancelled'?'Voided':i.ratingIssue?'Not in Elo':i.elo?.state==='counts'?'Counts for Elo':i.elo?.state==='waiting'?'Awaiting score confirmation':i.elo?.state==='earlier'?'Before Elo started':'No Elo score';return <article className="admin-friendly-match" key={i.id}>
        <div className="admin-friendly-main"><div className="admin-friendly-side"><Avatar id={i.firstId} name={i.firstName} version={i.firstAvatar} size={36}/><strong>{i.firstName}</strong></div><div className="admin-friendly-score" aria-label={i.result?`${i.result.first.goals} to ${i.result.second.goals}`:'No score'}>{i.result?<><b>{i.result.first.goals}</b><span>–</span><b>{i.result.second.goals}</b></>:<span>— : —</span>}</div><div className="admin-friendly-side admin-friendly-side-second"><Avatar id={i.secondId} name={i.secondName} version={i.secondAvatar} size={36}/><strong>{i.secondName}</strong></div></div>
        <div className="admin-friendly-meta"><span>{formatInZone(i.proposedAt,zone)}</span><span>{formatLabel(i.mode)}</span><span className={'admin-friendly-state '+(i.status==='cancelled'?'is-void':'')}>{i.status==='accepted'?'Played':statusText[i.status]??i.status}</span><span>{rated}</span>{i.mode==='clubs'&&i.result&&(i.result.first.stars!=null||i.result.second.stars!=null)&&<span>Teams: {i.result.first.stars??'—'} ★ / {i.result.second.stars??'—'} ★</span>}</div>
        {i.ratingIssue&&<p className="notice warning">{i.ratingIssue}</p>}
        {i.message&&<p className="fine-print">Note: {i.message}</p>}
        {i.status==='accepted'&&<div className="admin-friendly-actions"><AdminResultEditor key={i.id+':result:'+i.version} inv={i} timezone={zone} busy={busy} onSave={body=>void send(body)}/>{i.result&&<CorrectLoggedPlayers key={i.id+':players:'+i.version} inv={i} data={data} busy={busy} onSave={body=>void send(body)} onLinked={()=>void load()}/>}<button type="button" className="btn secondary" disabled={busy} onClick={()=>{const reason=window.prompt(`Void ${i.firstName} vs ${i.secondName}? The result will stop counting toward Elo. Enter a reason:`);if(reason&&reason.trim().length>=3)void send({action:'cancel',id:i.id,version:i.version,message:reason.trim()});}}>Void match</button></div>}
        {events.length>0&&<details className="sched-history"><summary>Activity ({events.length})</summary><ul>{events.map(e=><li key={e.id}><b>{eventText[e.action]??e.action}</b> <span className="fine-print">{e.actorName} · {formatInZone(e.at,zone)}{e.reason?` · ${e.reason}`:''}</span></li>)}</ul></details>}
      </article>;})}</div>:<p className="fine-print">No matches found for this filter.</p>}
    </section>;
  }
  if(mode==='history')return <section className="panel friendlies-panel"><h2>Friendly match history</h2><p className="fine-print">Played, cancelled and expired friendlies are saved here. Confirm scores or correct a logged result from its match card.</p>{error&&<p className="inline-error" role="alert">{error}</p>}{history.length?history.map(card):<p className="fine-print">No past friendlies yet.</p>}</section>;
  const matchMode=(i:Invitation)=>matchFilter==='all'||i.mode===matchFilter;
  const needsAnswer=waiting.filter(matchMode),upcoming=active.filter(i=>!i.myTurn&&matchMode(i)).sort((a,b)=>new Date(a.proposedAt).getTime()-new Date(b.proposedAt).getTime());
  const playedCount=history.filter(i=>i.status==='accepted'&&!!i.result).length;
  const action=(key:'invite'|'organize'|'log')=>setActiveAction(current=>current===key?null:key);
  return <div className="friendlies-hub">
    <section className="friendlies-hero" aria-labelledby="friendlies-heading">
      <div className="friendlies-hero-copy"><span className="eyebrow">UGS · PLAYER MATCHES</span><h2 id="friendlies-heading">Your next match starts here.</h2><p>Challenge a friend, play Clubs or Ultimate Team, and keep every result together.</p>
        <div className="friendlies-hero-actions"><button type="button" className="btn primary" onClick={()=>action('invite')} disabled={!data.me.eligible}><Plus size={17}/>Invite a player</button><button type="button" className="btn secondary" onClick={()=>action('log')} disabled={!data.me.eligible}><ClipboardCheck size={17}/>Log a result</button></div>
      </div><div className="friendlies-hero-art" aria-hidden="true"><div><Gamepad2 size={34}/><span>CLUBS</span></div><Swords size={30}/><div><Gamepad2 size={34}/><span>ULTIMATE</span></div></div>
    </section>
    <div className="friendlies-metrics" aria-label="Friendly match overview"><div><Clock3 size={21}/><span><strong>{active.length}</strong><small>Upcoming & pending</small></span></div><div><CalendarPlus size={21}/><span><strong>{waiting.length}</strong><small>Need your answer</small></span></div><div><History size={21}/><span><strong>{playedCount}</strong><small>Played matches</small></span></div></div>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {!data.me.eligible?<section className="panel friendlies-panel"><p className="notice">{data.me.reason??'Friendlies are not available to you yet.'}</p></section>:<>
      <section className="friendlies-actions" aria-label="Start a friendly"><div className="friendlies-section-head"><div><span className="eyebrow">GET PLAYING</span><h3>Choose what to do</h3></div><p>Games count for Elo at half weight once their scores are agreed.</p></div>
        <div className="friendlies-action-grid"><button type="button" className={'friendlies-action-card'+(activeAction==='invite'?' active':'')} aria-expanded={activeAction==='invite'} onClick={()=>action('invite')}><span className="friendlies-action-icon"><Swords size={24}/></span><strong>Challenge a player</strong><small>Pick an opponent and propose a time.</small><ArrowRight size={18}/></button>
          {data.me.owner&&<button type="button" className={'friendlies-action-card'+(activeAction==='organize'?' active':'')} aria-expanded={activeAction==='organize'} onClick={()=>action('organize')}><span className="friendlies-action-icon"><Users size={24}/></span><strong>Arrange for players</strong><small>Set up a match for two members.</small><ArrowRight size={18}/></button>}
          <button type="button" className={'friendlies-action-card'+(activeAction==='log'?' active':'')} aria-expanded={activeAction==='log'} onClick={()=>action('log')}><span className="friendlies-action-icon"><ClipboardCheck size={24}/></span><strong>Log a played game</strong><small>Record the score and team details.</small><ArrowRight size={18}/></button></div>
        {activeAction&&<div ref={actionPanelRef} className="friendlies-action-panel"><div className="friendlies-action-panel-head"><div><span className="eyebrow">{activeAction==='invite'?'NEW CHALLENGE':activeAction==='organize'?'ORGANIZER MATCH':'PLAYED RESULT'}</span><h3>{activeAction==='invite'?'Invite a player':activeAction==='organize'?'Arrange a friendly for two players':'Log a game you already played'}</h3></div><button type="button" className="icon-btn" aria-label="Close match form" onClick={()=>setActiveAction(null)}><X size={19}/></button></div>
          {activeAction==='invite'?<>
            {!data.directory.some(p=>p.eligible)&&<div className="notice"><p><b>No one is available to invite yet.</b></p>{data.unavailable?.length?<ul>{data.unavailable.map(u=><li key={u.name}><b>{u.name}</b>: {u.reason}</li>)}</ul>:<p className="fine-print">Other players appear once their gaming profile is complete.</p>}</div>}
            <div className="friendlies-form-grid"><label className="field">Game mode<select value={gameMode} onChange={e=>setGameMode(e.target.value as 'clubs'|'ultimate')}><option value="clubs">Clubs</option><option value="ultimate">Ultimate Team</option></select></label><label className="field">Opponent<select value={who} onChange={e=>setWho(e.target.value)}><option value="">Choose a player</option>{data.directory.filter(p=>p.eligible).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
            {timeForm('Send invitation',()=>void send({action:'invite',inviteeId:who,local:when,mode:gameMode,message}),!who)}
            <p className="fine-print">The other player must accept your proposed time. You can have up to {data.me.maxPending} pending invitations.</p>
          </>:activeAction==='organize'&&data.me.owner?<OrganizeForm data={data} timezone={timezone} onDone={()=>void load()}/>:<LogForm data={data} timezone={timezone} onDone={()=>void load()}/>}
        </div>}
      </section>
      <section className="friendlies-board" aria-labelledby="friendlies-board-title"><div className="friendlies-section-head"><div><span className="eyebrow">MATCH BOARD</span><h3 id="friendlies-board-title">Upcoming & waiting</h3></div><a className="friendlies-history-link" href={viewHref('history')}>View match history <ArrowRight size={16}/></a></div>
        <div className="friendlies-mode-filters" role="group" aria-label="Filter friendlies by game mode">{([['all','All'],['clubs','Clubs'],['ultimate','Ultimate Team']] as const).map(([value,label])=><button type="button" key={value} className={matchFilter===value?'active':''} aria-pressed={matchFilter===value} onClick={()=>setMatchFilter(value)}>{label}</button>)}</div>
        {needsAnswer.length>0&&<div className="friendlies-match-group"><h4>Needs your answer <span>{needsAnswer.length}</span></h4><div className="friendlies-match-grid">{needsAnswer.map(card)}</div></div>}
        <div className="friendlies-match-group"><h4>Scheduled & pending <span>{upcoming.length}</span></h4>{upcoming.length?<div className="friendlies-match-grid">{upcoming.map(card)}</div>:<div className="friendlies-empty"><Gamepad2 size={32}/><strong>{matchFilter==='all'?'No matches on the calendar yet.':`No ${formatLabel(matchFilter)} matches right now.`}</strong><p>Invite someone to get a game started.</p><button type="button" className="btn secondary" onClick={()=>action('invite')}><Plus size={16}/>Invite a player</button></div>}</div>
      </section>
      <p className="friendlies-rules-note">Clubs use optional 3.5–5 star ratings. Ultimate Team has no club-star adjustment. Winning by more and keeping a clean sheet increase Elo. <a href={viewHref('guide')}>Read the rules</a>.</p>
    </>}
  </div>;
}

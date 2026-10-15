'use client';
import {useCallback,useEffect,useState} from 'react';
import {Dices,Trophy,XCircle} from 'lucide-react';
import {VOTED_TEAMS,DEFAULT_DIRECT} from '@/lib/team-vote-data';
import {api,Empty} from './ui';
import type {AppState} from './ui';

type Entry={rank:number;team:string;votes:number;strength:number;direct:boolean};
type Leg={home:string;homeGoals:number;away:string;awayGoals:number};
type Tie={position:number;high:Entry;low:Entry;leg1:Leg|null;leg2:Leg|null;aggregate:{high:number;low:number}|null;penalties:{high:number;low:number}|null;winner:string|null};
type Playoff={id:string;name:string;status:'ready'|'simulated';version:number;directCount:number;seed:string|null;simulatedAt:string|null;entries:Entry[];ties:Tie[];qualified:string[]};
type Data={playoff:Playoff|null;cancelled:{id:string;name:string;cancelled_at:string;cancel_reason:string}[]};

export default function TeamPlayoffs({state}:{state:AppState|null}){
  const tid=state?.tournament?.id,owner=state?.member?.role==='admin';
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [direct,setDirect]=useState(DEFAULT_DIRECT),[name,setName]=useState('Team vote playoff'),[confirmRun,setConfirmRun]=useState(false),[why,setWhy]=useState(''),[cancelling,setCancelling]=useState(false);
  const load=useCallback(async()=>{if(!tid)return;try{setData(await api<Data>(`tournament/${tid}/team-playoffs`));}catch(e){setError((e as Error).message);}},[tid]);
  useEffect(()=>{void load();},[load]);
  async function act(path:string,body:unknown,after?:()=>void){setBusy(true);setError('');try{await api(`tournament/${tid}/team-playoffs${path}`,body);after?.();await load();}catch(e){setError((e as Error).message);await load();}finally{setBusy(false);}}
  if(!tid)return <Empty title="Create a tournament first" description="The team vote playoff belongs to a tournament."/>;
  if(!data)return <section className="panel">{error?<p className="inline-error" role="alert">{error}</p>:<p className="fine-print">Loading…</p>}</section>;
  const p=data.playoff;
  const rest=VOTED_TEAMS.length-direct,validSize=rest>=2&&rest%2===0;
  const leg=(l:Leg|null)=>l?<span className="tp-leg"><b>{l.home}</b> {l.homeGoals}–{l.awayGoals} <b>{l.away}</b></span>:<span className="tp-leg muted">Not played yet</span>;
  return <div className="tp-wrap">
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {!p&&<section className="panel tp-create">
      <div className="section-heading"><div><span className="eyebrow">COMMUNITY VOTE</span><h2>Team playoff</h2></div><Trophy size={23}/></div>
      <p className="fine-print">No team playoff yet. {owner?'The final vote order below is already filled in. Top teams go straight through; the rest are paired best against worst and simulated home and away.':'The organizer has not created it yet.'}</p>
      {owner&&<>
        <div className="tp-form"><label>Name<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
        <label>Teams that qualify directly<input type="number" min={0} max={VOTED_TEAMS.length-2} value={direct} onChange={e=>setDirect(Math.max(0,Math.floor(Number(e.target.value)||0)))}/></label></div>
        <p className={validSize?'fine-print':'inline-error'}>{validSize?`${direct} direct, ${rest} in the playoff (${rest/2} ties). ${direct+rest/2} teams qualify.`:`${rest} teams would be left for the playoff. It needs an even number.`}</p>
        <ol className="tp-order">{VOTED_TEAMS.map((t,i)=><li key={t.team} className={i<direct?'direct':''}><span>{i+1}</span><b>{t.team}</b><small>{t.votes} votes</small></li>)}</ol>
        <button className="btn lime" disabled={busy||!validSize||!name.trim()} onClick={()=>void act('',{name,directCount:direct,entries:VOTED_TEAMS.map(t=>({team:t.team,votes:t.votes}))})}>Create playoff</button>
      </>}
    </section>}
    {p&&<>
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">{p.status==='simulated'?'SIMULATED':'READY TO SIMULATE'}</span><h2>{p.name}</h2></div><Dices size={23}/></div>
        <p className="fine-print">{p.directCount} teams go through directly. The other {p.entries.length-p.directCount} are paired best against worst. Each tie is two legs: the lower seed hosts the first, the higher seed hosts the second. Level on aggregate goes to penalties. No players are involved and Elo is not affected.</p>
        {p.seed&&<p className="fine-print">Simulation seed: <code>{p.seed}</code> (the same seed always gives the same results).</p>}
        <div className="tp-direct"><span className="eyebrow">DIRECT QUALIFIERS</span><div>{p.entries.filter(e=>e.direct).map(e=><span className="tp-chip" key={e.rank}>#{e.rank} {e.team}</span>)}</div></div>
      </section>
      <section className="panel"><div className="section-heading"><h2>Ties</h2></div>
        <div className="tp-ties">{p.ties.map(t=><article className="tp-tie" key={t.position}>
          <header><span>Tie {t.position}</span>{t.winner&&<b className="tp-win">Through: {t.winner}</b>}</header>
          <p className="tp-seeds"><b>#{t.high.rank} {t.high.team}</b> vs <b>#{t.low.rank} {t.low.team}</b></p>
          <p><small>Leg 1</small> {leg(t.leg1)}</p>
          <p><small>Leg 2</small> {leg(t.leg2)}</p>
          {t.aggregate&&<p className="fine-print">Aggregate {t.high.team} {t.aggregate.high}–{t.aggregate.low} {t.low.team}{t.penalties?` · penalties ${t.penalties.high}–${t.penalties.low}`:''}</p>}
        </article>)}</div>
      </section>
      {p.status==='simulated'&&<section className="panel"><div className="section-heading"><div><span className="eyebrow">RESULT</span><h2>Qualified teams ({p.qualified.length})</h2></div></div><ol className="tp-order">{p.qualified.map((t,i)=><li key={t}><span>{i+1}</span><b>{t}</b></li>)}</ol></section>}
      {owner&&<section className="panel tp-actions">
        {p.status==='ready'&&(confirmRun
          ?<p>Run the simulation now? It can only be run once; to change it you would cancel and create a new playoff. <button className="btn lime" disabled={busy} onClick={()=>void act('/simulate',{id:p.id,version:p.version},()=>setConfirmRun(false))}>Yes, simulate</button> <button className="btn secondary" onClick={()=>setConfirmRun(false)}>Not yet</button></p>
          :<button className="btn lime" disabled={busy} onClick={()=>setConfirmRun(true)}>Run simulation</button>)}
        {cancelling
          ?<div className="tp-form"><label>Reason<input value={why} maxLength={300} onChange={e=>setWhy(e.target.value)} placeholder="Why is it being cancelled?"/></label><button className="btn secondary" disabled={busy||why.trim().length<3} onClick={()=>void act('/cancel',{id:p.id,version:p.version,reason:why},()=>{setCancelling(false);setWhy('');})}>Confirm cancel</button> <button className="btn secondary" onClick={()=>setCancelling(false)}>Keep it</button></div>
          :<button className="btn secondary" onClick={()=>setCancelling(true)}><XCircle size={16}/> Cancel playoff</button>}
      </section>}
    </>}
    {data.cancelled.length>0&&<section className="panel"><span className="eyebrow">CANCELLED</span>{data.cancelled.map(c=><p className="fine-print" key={c.id}><b>{c.name}</b> · {c.cancel_reason}</p>)}</section>}
  </div>;
}

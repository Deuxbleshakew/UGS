'use client';
import {useCallback,useEffect,useState} from 'react';
import {Trophy,XCircle} from 'lucide-react';
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
  const tag=(e:Entry)=>`#${e.rank}`;
  const cell=(v:number|undefined)=>v==null?'–':String(v);
  const ties=p?.ties??[],done=p?.status==='simulated';
  const viaPlayoff=new Set(ties.map(t=>t.winner).filter(Boolean) as string[]);
  return <div className="tp-wrap">
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {!p&&<section className="tp-card">
      <header className="tp-hero"><div><span className="eyebrow">COMMUNITY VOTE</span><h2>Team playoff</h2><p>{owner?'The final vote order is filled in. Top teams go straight through; the rest are paired best against worst and played home and away.':'The organizer has not created the playoff yet.'}</p></div><Trophy size={30}/></header>
      {owner&&<>
        <div className="tp-form"><label>Name<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
        <label>Direct qualifiers<input type="number" min={0} max={VOTED_TEAMS.length-2} value={direct} onChange={e=>setDirect(Math.max(0,Math.floor(Number(e.target.value)||0)))}/></label>
        <button className="btn lime" disabled={busy||!validSize||!name.trim()} onClick={()=>void act('',{name,directCount:direct,entries:VOTED_TEAMS.map(t=>({team:t.team,votes:t.votes}))})}>Create playoff</button></div>
        <p className={validSize?'tp-hint':'inline-error'}>{validSize?`${direct} direct · ${rest} in the playoff (${rest/2} ties) · ${direct+rest/2} teams qualify`:`${rest} teams would be left for the playoff. It needs an even number.`}</p>
        <ol className="tp-order">{VOTED_TEAMS.map((t,i)=><li key={t.team} className={i<direct?'direct':''}><span>{i+1}</span><b>{t.team}</b><small>{t.votes}</small></li>)}</ol>
      </>}
    </section>}
    {p&&<>
      <section className="tp-card">
        <header className="tp-hero">
          <div><span className={`tp-state ${done?'done':'ready'}`}>{done?'Complete':'In progress'}</span><h2>{p.name}</h2>
            <p>Two legs per tie. The lower seed hosts the first leg and the higher seed hosts the second. Level on aggregate goes to penalties. The ties are played in EA FC and the organizer enters the scores. Elo is not affected.</p></div>
        </header>
        <div className="tp-stats">
          <div><b>{p.entries.length}</b><span>Teams voted</span></div>
          <div><b>{p.directCount}</b><span>Direct places</span></div>
          <div><b>{ties.length}</b><span>Playoff ties</span></div>
          <div><b>{p.directCount+ties.length}</b><span>Teams qualify</span></div>
        </div>
      </section>
      <section className="tp-card">
        <div className="tp-title"><span className="eyebrow">STRAIGHT THROUGH</span><h3>Direct qualifiers</h3></div>
        <div className="tp-direct">{p.entries.filter(e=>e.direct).map(e=><span className="tp-chip" key={e.rank}><i>{e.rank}</i>{e.team}</span>)}</div>
      </section>
      <section className="tp-card">
        <div className="tp-title"><span className="eyebrow">HOME AND AWAY</span><h3>Playoff ties</h3></div>
        <div className="tp-ties">{ties.map(t=>{
          const lowWon=t.winner===t.low.team,highWon=t.winner===t.high.team,played=!!t.aggregate;
          const row=(e:Entry,won:boolean,l1:number|undefined,l2:number|undefined,agg:number|undefined,pen:number|undefined)=><div className={`tp-row${won?' won':''}${played&&!won?' lost':''}`}>
            <span className="tp-seed">{tag(e)}</span><b className="tp-team">{e.team}</b>
            <span className="tp-n">{cell(l1)}</span><span className="tp-n">{cell(l2)}</span><span className="tp-n tp-agg">{cell(agg)}{pen!=null&&<sup>({pen})</sup>}</span></div>;
          return <article className="tp-tie" key={t.position}>
            <header><span>Tie {t.position}</span>{t.winner?<b className="tp-win">{t.winner} through</b>:<b className="tp-wait">Awaiting result</b>}</header>
            <div className="tp-head"><span/><span/><span className="tp-n">Leg 1</span><span className="tp-n">Leg 2</span><span className="tp-n">Agg</span></div>
            {owner&&p.status==='ready'&&!t.winner?<ResultForm tie={t} busy={busy} onSave={body=>act('/result',{id:p.id,version:p.version,position:t.position,...body})}/>:<>
            {row(t.high,highWon,t.leg1?.awayGoals,t.leg2?.homeGoals,t.aggregate?.high,t.penalties?.high)}
            {row(t.low,lowWon,t.leg1?.homeGoals,t.leg2?.awayGoals,t.aggregate?.low,t.penalties?.low)}</>}
            <footer>Leg 1 at {t.low.team} · Leg 2 at {t.high.team}{t.penalties?' · decided on penalties':''}</footer>
          </article>;})}</div>
      </section>
      {done&&<section className="tp-card">
        <div className="tp-title"><span className="eyebrow">RESULT</span><h3>Qualified teams ({p.qualified.length})</h3></div>
        <ol className="tp-qual">{p.qualified.map((t,i)=><li key={t}><span>{i+1}</span><b>{t}</b><small className={viaPlayoff.has(t)?'via':''}>{viaPlayoff.has(t)?'Playoff winner':'Direct'}</small></li>)}</ol>
      </section>}
      {owner&&<section className="tp-card tp-actions">
        {cancelling
          ?<div className="tp-form"><label>Reason for cancelling<input value={why} maxLength={300} onChange={e=>setWhy(e.target.value)} placeholder="Why is it being cancelled?"/></label><button className="btn secondary" disabled={busy||why.trim().length<3} onClick={()=>void act('/cancel',{id:p.id,version:p.version,reason:why},()=>{setCancelling(false);setWhy('');})}>Confirm cancel</button><button className="btn secondary" onClick={()=>setCancelling(false)}>Keep it</button></div>
          :<button className="btn secondary" onClick={()=>setCancelling(true)}><XCircle size={16}/> Cancel playoff</button>}
      </section>}
    </>}
    {data.cancelled.length>0&&<section className="tp-card"><span className="eyebrow">CANCELLED</span>{data.cancelled.map(c=><p className="tp-hint" key={c.id}><b>{c.name}</b> · {c.cancel_reason}</p>)}</section>}
  </div>;
}

function ResultForm({tie,busy,onSave}:{tie:Tie;busy:boolean;onSave:(body:object)=>void}){
  const [v,setV]=useState({l1l:'',l1h:'',l2l:'',l2h:'',pl:'',ph:''});
  const n=(x:string)=>x===''?NaN:Number(x),set=(k:keyof typeof v)=>(e:{target:{value:string}})=>setV({...v,[k]:e.target.value.replace(/\D/g,'').slice(0,2)});
  const all=[v.l1l,v.l1h,v.l2l,v.l2h].every(x=>x!==''),low=n(v.l1l)+n(v.l2l),high=n(v.l1h)+n(v.l2h),level=all&&low===high;
  const ok=all&&(!level||(v.pl!==''&&v.ph!==''&&v.pl!==v.ph));
  const box=(k:keyof typeof v,label:string)=><input className="tp-in" inputMode="numeric" placeholder="–" value={v[k]} onChange={set(k)} aria-label={label}/>;
  const agg=(x:number)=>all?String(x):'–';
  return <div className="tp-entry">
    <div className="tp-row"><span className="tp-seed">#{tie.high.rank}</span><b className="tp-team">{tie.high.team}</b>{box('l1h',`${tie.high.team} leg 1 goals`)}{box('l2h',`${tie.high.team} leg 2 goals (home)`)}<span className="tp-n tp-agg">{agg(high)}</span></div>
    <div className="tp-row"><span className="tp-seed">#{tie.low.rank}</span><b className="tp-team">{tie.low.team}</b>{box('l1l',`${tie.low.team} leg 1 goals (home)`)}{box('l2l',`${tie.low.team} leg 2 goals`)}<span className="tp-n tp-agg">{agg(low)}</span></div>
    {level&&<div className="tp-row tp-pen-row"><span/><b className="tp-team">Penalties · {tie.high.team} / {tie.low.team}</b>{box('ph',`${tie.high.team} penalties`)}{box('pl',`${tie.low.team} penalties`)}<span/></div>}
    <button className="btn lime tp-save" disabled={busy||!ok} onClick={()=>onSave({leg1:{lowGoals:n(v.l1l),highGoals:n(v.l1h)},leg2:{lowGoals:n(v.l2l),highGoals:n(v.l2h)},...(level?{pens:{low:n(v.pl),high:n(v.ph)}}:{})})}>Save result</button>
  </div>;
}

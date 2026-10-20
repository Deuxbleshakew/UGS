'use client';
import {useEffect,useState} from 'react';
import {ArrowDownToLine} from 'lucide-react';
import type {AppState,Audit} from './ui';
import {api} from './ui';
import {HistoryView} from './guide-history';
import Friendlies from './friendlies';

type Tab='matches'|'friendlies'|'tournament'|'accounts';
type AccountEvent={id:string;username:string;action:string;at:string};
const label=(action:string)=>action.replaceAll('-',' ');

export default function HistoryHub({state}:{state:AppState|null}){
  const [tab,setTab]=useState<Tab>('matches');
  const [accountEvents,setAccountEvents]=useState<AccountEvent[]|null>(null);
  const [accountError,setAccountError]=useState('');
  const [tournamentActivity,setTournamentActivity]=useState<{id:string;events:Audit[]}|null>(null);
  const [tournamentError,setTournamentError]=useState('');
  const owner=!!state?.user.isOwner;
  const tournamentId=state?.tournament?.id;
  useEffect(()=>{
    if(tab!=='accounts'||!owner||accountEvents!==null)return;
    let cancelled=false;
    api<{events:AccountEvent[]}>('accounts/history').then(data=>{if(!cancelled)setAccountEvents(data.events);}).catch(error=>{if(!cancelled)setAccountError((error as Error).message);});
    return()=>{cancelled=true;};
  },[tab,owner,accountEvents]);
  useEffect(()=>{
    if(tab!=='tournament'||!owner||!tournamentId||tournamentActivity?.id===tournamentId)return;
    let cancelled=false;
    api<{events:Audit[]}>(`tournament/${tournamentId}/history`).then(data=>{if(!cancelled){setTournamentActivity({id:tournamentId,events:data.events});setTournamentError('');}}).catch(error=>{if(!cancelled)setTournamentError((error as Error).message);});
    return()=>{cancelled=true;};
  },[tab,owner,tournamentId,tournamentActivity]);
  const options:{id:Tab;title:string}[]=[{id:'matches',title:'Tournament matches'},{id:'friendlies',title:'Friendlies'}];
  if(owner){options.push({id:'tournament',title:'Tournament activity'},{id:'accounts',title:'Account activity'});}
  return <div className="history-hub">
    <div className="filterbar no-panel"><div className="tabs" role="tablist" aria-label="History type">{options.map(option=><button key={option.id} id={`history-tab-${option.id}`} type="button" role="tab" aria-selected={tab===option.id} className={tab===option.id?'selected':''} onClick={()=>setTab(option.id)}>{option.title}</button>)}</div></div>
    <div role="tabpanel" aria-labelledby={`history-tab-${tab}`}>
    {tab==='matches'&&<HistoryView state={state}/>}
    {tab==='friendlies'&&<Friendlies mode="history" timezone={state?.profile?.data.timezone}/>}
    {tab==='tournament'&&owner&&<section className="panel"><div className="section-heading"><h2>Tournament activity</h2>{state?.tournament&&<button className="text-btn" onClick={()=>{window.location.href=`/api/tournament/${state.tournament!.id}/export?kind=audit`;}}>Export full history <ArrowDownToLine size={16}/></button>}</div><p className="fine-print">Changes in {state?.tournament?.name??'the selected tournament'}, newest first.</p>{tournamentError&&<p className="inline-error" role="alert">{tournamentError}</p>}{!tournamentId?<p className="fine-print">Choose a tournament to see its activity.</p>:tournamentActivity?.id!==tournamentId&&!tournamentError?<p className="fine-print">Loading tournament activity…</p>:tournamentActivity?.id===tournamentId&&tournamentActivity.events.length?tournamentActivity.events.map(event=><details className="audit-row" key={event.id}><summary><span className="audit-dot"/><span><b>{label(event.action)}</b><small>{event.actor_name} · {new Date(event.at).toLocaleString()}</small></span></summary><p>{event.reason}</p><div className="audit-values"><div><label>Before</label><pre>{event.before??'—'}</pre></div><div><label>After</label><pre>{event.after??'—'}</pre></div></div></details>):!tournamentError?<p className="fine-print">No tournament activity saved yet.</p>:null}</section>}
    {tab==='accounts'&&owner&&<section className="panel"><h2>Account activity</h2><p className="fine-print">Recent changes to logins and access. Deleted account names are omitted because their data was erased.</p>{accountError&&<p className="inline-error" role="alert">{accountError}</p>}{accountEvents===null&&!accountError?<p className="fine-print">Loading account activity…</p>:accountEvents?.length?accountEvents.map(event=><div className="audit-row" key={event.id}><b>{label(event.action)}</b><small>{event.username?` · @${event.username}`:''} · {new Date(event.at).toLocaleString()}</small></div>):!accountError?<p className="fine-print">No account changes saved yet.</p>:null}</section>}
    </div>
  </div>;
}

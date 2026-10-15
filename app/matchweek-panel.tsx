'use client';
import {useState} from 'react';
import {api,type AppState} from './ui';
export default function MatchweekPanel({state,onRefresh}:{state:AppState;onRefresh:()=>Promise<unknown>}){
 const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const weeks=state.matchweeks,admin=state.member?.role==='admin';
 if(!state.tournament||!weeks||!weeks.weeks.length)return null;
 async function change(action:'enable'|'advance'){
  if(!weeks||busy)return;setBusy(true);setError('');
  try{await api(`tournament/${state.tournament!.id}/matchweeks`,{action,version:weeks.version,assignmentsReviewed:reviewed});await onRefresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel matchweek-panel"><h2>{weeks.enabled?`Matchweek ${weeks.currentWeek}`:'Review matchweek assignments'}</h2>
  <p>{weeks.enabled?'The owner opens each next week after every current result is finalized. Future kickoff bookings remain tentative.':'Sequential locks are off. Imported draws start in matchday 1; use each fixture’s calendar controls to assign the real weeks first.'}</p>
  <div className="profile-team-options">{weeks.weeks.map(w=><div key={w.week}><strong>Week {w.week} · {w.locked?'Locked':weeks.enabled&&w.week===weeks.currentWeek?'Current':weeks.enabled?'Opened':'Unrestricted'}</strong><p>{w.finalized}/{w.total} finalized · {w.outstanding} outstanding</p></div>)}</div>
  {admin&&!weeks.enabled&&<><p className="notice">Enabling locks freezes league week assignments and prevents adding/deleting league fixtures. Qualification rounds remain separate.</p><label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/> I reviewed the complete league calendar and assigned each fixture to its actual week.</label><button className="btn primary" disabled={busy||!reviewed||weeks.weeks.length<2} onClick={()=>void change('enable')}>Enable sequential matchweeks</button></>}
  {admin&&weeks.enabled&&<button className="btn primary" disabled={busy||!weeks.canAdvance} onClick={()=>void change('advance')}>{busy?'Saving…':'Open next matchweek'}</button>}
  {error&&<p className="notice error" role="alert">{error}</p>}
 </section>;
}

'use client';
import {useCallback,useEffect,useState} from 'react';
import {formatInZone,utcToZonedLocal,zonedLocalToUtc,zoneMessages} from '@/lib/timezone';
import {api} from './ui';
import {viewerZone,type ScheduleState} from './match-scheduling';

/** Owner-only: booking length, season dates and per-matchweek deadlines. Nothing here has a built-in default. */
export default function ScheduleSettings({tid,weeks,timezone}:{tid:string;weeks:number[];timezone?:string}){
  const zone=viewerZone(timezone),[data,setData]=useState<ScheduleState|null>(null),[error,setError]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
  const [minutes,setMinutes]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[week,setWeek]=useState(weeks[0]??1),[opens,setOpens]=useState(''),[deadline,setDeadline]=useState(''),[reason,setReason]=useState('');
  const load=useCallback(async()=>{try{const s=await api<ScheduleState>(`tournament/${tid}/schedule`);setData(s);setMinutes(s.settings.booking_minutes?.toString()??'');setStart(s.settings.season_start?utcToZonedLocal(s.settings.season_start,zone):'');setEnd(s.settings.season_end?utcToZonedLocal(s.settings.season_end,zone):'');}catch(e){setError((e as Error).message);}},[tid,zone]);
  useEffect(()=>{void load();},[load]);
  const utc=(v:string)=>{if(!v)return null;const r=zonedLocalToUtc(v,zone);if(!r.ok)throw new Error(zoneMessages[r.reason]);return r.utc;};
  async function run(path:string,body:Record<string,unknown>){setBusy(true);setError('');setOk('');try{await api(`tournament/${tid}/schedule/${path}`,body);setOk('Saved.');setReason('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(!data)return error?<p className="inline-error" role="alert">{error}</p>:null;
  const existing=data.windows.find(w=>!w.fixture_id&&w.matchday===week);
  return <section className="panel schedule-settings"><h2>Scheduling rules</h2>
    <p className="fine-print">Times are entered in {zone}. Leave a field empty to keep it undecided; nothing is assumed.</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}{ok&&<p className="notice" role="status">{ok}</p>}
    <div className="form-two">
      <label className="field">Booking length (minutes)<input type="number" min={1} max={1440} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
      <span/>
      <label className="field">Season starts<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label className="field">Season ends<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    </div>
    <button type="button" className="btn secondary" disabled={busy} onClick={()=>{try{void run('settings',{version:data.settings.version,bookingMinutes:minutes?Number(minutes):null,seasonStart:utc(start),seasonEnd:utc(end)});}catch(e){setError((e as Error).message);}}}>Save booking length and season</button>
    <h3>Match window by matchweek</h3>
    {weeks.length?<>
      <div className="form-two">
        <label className="field">Matchweek<select value={week} onChange={e=>{const w=Number(e.target.value),x=data.windows.find(v=>!v.fixture_id&&v.matchday===w);setWeek(w);setOpens(x?.opens_at?utcToZonedLocal(x.opens_at,zone):'');setDeadline(x?.deadline_at?utcToZonedLocal(x.deadline_at,zone):'');}}>{weeks.map(w=><option key={w} value={w}>Week {w}</option>)}</select></label>
        <span/>
        <label className="field">Window opens <small>Optional</small><input type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/></label>
        <label className="field">Deadline <small>Optional</small><input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
      </div>
      {existing&&<p className="fine-print">Current: {existing.deadline_at?`deadline ${formatInZone(existing.deadline_at,zone)}`:'no deadline'}. Changing it needs a reason.</p>}
      {existing&&<label className="field">Reason for the change<input maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
      <button type="button" className="btn secondary" disabled={busy||(!!existing&&reason.trim().length<3)} onClick={()=>{try{void run('window',{scope:'week',matchday:week,version:existing?.version??0,opensAt:utc(opens),deadlineAt:utc(deadline),reason});}catch(e){setError((e as Error).message);}}}>Save window</button>
      <p className="fine-print">Kickoffs after the deadline need the opponent’s agreement and your approval with a reason. Missing a deadline never forfeits a match automatically.</p>
    </>:<p className="fine-print">Windows appear once league fixtures have matchweeks.</p>}
  </section>;
}

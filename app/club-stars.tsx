'use client';
import {useState} from 'react';
import {Star} from 'lucide-react';
import {api} from './ui';

const OPTIONS=Array.from({length:10},(_,i)=>(i+1)/2);
export function Stars({value}:{value:number}){
  return <span className="stars" role="img" aria-label={`${value} stars`}>{[1,2,3,4,5].map(n=><Star key={n} size={14} className={value>=n?'on':value>=n-0.5?'half':''}/>)}<b>{value}</b></span>;
}
export function ClubStars({tid,clubId,value,editable,onSaved}:{tid:string;clubId:string;value?:number;editable:boolean;onSaved?:()=>unknown}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(v:string){setBusy(true);setError('');try{await api(`tournament/${tid}/club-stars`,{stars:{[clubId]:v===''?null:Number(v)}});await onSaved?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="club-stars">
    {value!=null?<Stars value={value}/>:<span className="muted">No stars set</span>}
    {editable&&<select aria-label="Club stars" value={value??''} disabled={busy} onChange={e=>void save(e.target.value)}><option value="">Not set</option>{OPTIONS.map(o=><option key={o} value={o}>{o} ★</option>)}</select>}
    {error&&<small className="inline-error" role="alert">{error}</small>}
  </div>;
}

'use client';
import {useEffect} from 'react';
import {Crest,PlayerFace} from './ui';
import {clubSquad,useFootballers} from '@/lib/footballers';

const GROUPS:{key:string;label:string;pos:string[]}[]=[
  {key:'gk',label:'Goalkeepers',pos:['GK']},
  {key:'def',label:'Defenders',pos:['CB','LB','RB','LWB','RWB']},
  {key:'mid',label:'Midfielders',pos:['CDM','CM','CAM','LM','RM']},
  {key:'att',label:'Attackers',pos:['ST','CF','LW','RW']},
];
export function ClubSquad({name,pot,manager,onClose}:{name:string;pot?:string;manager?:string;onClose:()=>void}){
  const roster=useFootballers(),sq=clubSquad(roster,name);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();},prev=document.body.style.overflow;document.addEventListener('keydown',key);document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=prev;};},[onClose]);
  const rows=sq?.rows??[],known=new Set(GROUPS.flatMap(g=>g.pos));
  const groups=GROUPS.map(g=>({...g,list:rows.filter(r=>g.pos.includes(r[3])).sort((a,b)=>b[4]-a[4])}));
  const other=rows.filter(r=>!known.has(r[3]));
  if(other.length)groups.push({key:'other',label:'Other',pos:[],list:other});
  return <div className="club-squad-overlay" onClick={onClose}><section className="panel club-squad" role="dialog" aria-modal="true" aria-label={`${name} squad`} onClick={e=>e.stopPropagation()}>
    <div className="club-squad-head"><Crest club={{id:name,name}}/><div><h3>{name}</h3><p className="fine-print">{[pot,manager?`Manager: ${manager}`:null,sq?`${rows.length} players`:null].filter(Boolean).join(' · ')}</p></div><button type="button" className="btn secondary" onClick={onClose}>Close</button></div>
    {!sq?<p className="fine-print">{roster?'Squad not available yet.':'Loading squad…'}</p>:groups.filter(g=>g.list.length).map(g=><div key={g.key} className={`squad-group g-${g.key}`}><h4>{g.label} <small>{g.list.length}</small></h4>
      <div className="squad-grid">{g.list.map(r=><details key={r[0]} className="squad-player"><summary><PlayerFace club={name} name={r[1]} size={44}/><span><b>{r[1]}</b><small>#{r[2]} · {r[3]} · {r[4]}</small></span></summary>
        <dl className="squad-stats">{[['Apps'],['Goals'],['Assists'],['Avg rating']].map(([k])=><div key={k}><dt>{k}</dt><dd>–</dd></div>)}<p className="fine-print">No stats yet. They appear here once results are logged.</p></dl></details>)}</div></div>)}
  </section></div>;
}

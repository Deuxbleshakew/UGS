'use client';
import {useCallback,useEffect,useState} from 'react';
import {Pencil,Plus,Trash2,Users} from 'lucide-react';
import {api} from './ui';

const POSITIONS=['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST'];
type P={id:string;name:string;position:string;gamertag:string;shirtNumber:number|null};
type Data={players:P[];canEdit?:boolean};
const empty={name:'',position:'ST',gamertag:'',shirtNumber:''};

export default function TiquiciaRoster(){
  const [players,setPlayers]=useState<P[]|null>(null),[canEdit,setCanEdit]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [form,setForm]=useState(empty),[editing,setEditing]=useState<string|null>(null),[open,setOpen]=useState(false);
  const load=useCallback(async()=>{try{const d=await api<Data>('tiquicia');setPlayers(d.players);setCanEdit(!!d.canEdit);}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void load();},[load]);
  async function send(body:object,done?:()=>void){setBusy(true);setError('');try{const d=await api<Data>('tiquicia',body);setPlayers(d.players);done?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const reset=()=>{setForm(empty);setEditing(null);setOpen(false);};
  const save=()=>void send({action:editing?'update':'add',...(editing?{id:editing}:{}),name:form.name,position:form.position,gamertag:form.gamertag,shirtNumber:form.shirtNumber===''?null:Number(form.shirtNumber)},reset);
  return <section className="panel tq-roster"><Users size={24}/><div className="tq-head"><h2>Team roster</h2>{canEdit&&!open&&<button type="button" className="btn primary" onClick={()=>setOpen(true)}><Plus size={15}/> Add player</button>}</div>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {open&&<div className="tq-form">
      <label className="field">Name<input value={form.name} maxLength={60} onChange={e=>setForm({...form,name:e.target.value})} autoFocus/></label>
      <label className="field">Position<select value={form.position} onChange={e=>setForm({...form,position:e.target.value})}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></label>
      <label className="field">Gamertag <small>Optional</small><input value={form.gamertag} maxLength={40} onChange={e=>setForm({...form,gamertag:e.target.value})}/></label>
      <label className="field">Number <small>Optional</small><input inputMode="numeric" value={form.shirtNumber} onChange={e=>setForm({...form,shirtNumber:e.target.value.replace(/\D/g,'').slice(0,2)})}/></label>
      <div className="sched-actions"><button type="button" className="btn primary" disabled={busy||!form.name.trim()} onClick={save}>{editing?'Save changes':'Add to roster'}</button><button type="button" className="btn secondary" disabled={busy} onClick={reset}>Cancel</button></div>
    </div>}
    {players==null?<p className="fine-print">Loading…</p>:players.length===0?<p className="tq-empty">No players on the roster yet.{canEdit&&' Use “Add player” to start it.'}</p>
      :<ul className="tq-list">{players.map(p=><li key={p.id}><span className="tq-num">{p.shirtNumber??'–'}</span><div><b>{p.name}</b>{p.gamertag&&<small>{p.gamertag}</small>}</div><em className="tq-pos">{p.position}</em>
        {canEdit&&<span className="tq-actions"><button type="button" className="icon-btn" aria-label={`Edit ${p.name}`} disabled={busy} onClick={()=>{setForm({name:p.name,position:p.position,gamertag:p.gamertag,shirtNumber:p.shirtNumber==null?'':String(p.shirtNumber)});setEditing(p.id);setOpen(true);}}><Pencil size={15}/></button><button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} disabled={busy} onClick={()=>{if(window.confirm(`Remove ${p.name} from the roster?`))void send({action:'remove',id:p.id});}}><Trash2 size={15}/></button></span>}</li>)}</ul>}
  </section>;
}

'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Copy,LockKeyhole,Plus,Trash2} from 'lucide-react';
import {BUILD_UP_NAMES,FORMATIONS,decodeTactic,defaultTactic,encodeTactic,formationByKey,formationLabel,layoutFor,optionLabel,optionsFor,remapRoles,roleName,validateTactic,type BuildUp} from '@/lib/eafc-tactics';
import {fromShareCode,toShareCode,type Slot} from '@/lib/squad-data';
import {api,Empty} from './ui';
import type {AppState} from './ui';

type Squad={id:string;slotNo:number;name:string;formation:string;buildUp:string;lineHeight:number;slots:Slot[];eaCode:string;version:number;mine:boolean;ownerName:string;clubs:string[]};
type Data={drawn:boolean;open:boolean;openedEarly:boolean;isOwner:boolean;canBuild:boolean;myClubs:string[];squads:Squad[]};
type Draft={id?:string;version?:number;slotNo:number;name:string;formation:string;buildUp:BuildUp;lineHeight:number;slots:Slot[]};
const blank=(slotNo:number):Draft=>{const d=defaultTactic('352');return {slotNo,name:slotNo===0?'My starting tactic':`Squad tactic ${slotNo}`,formation:d.formationKey,buildUp:d.buildUp,lineHeight:d.lineHeight,slots:d.roleIds.map(ea=>({ea,player:''}))};};
const fromSquad=(s:Squad):Draft=>({id:s.id,version:s.version,slotNo:s.slotNo,name:s.name,formation:s.formation,buildUp:s.buildUp as BuildUp,lineHeight:s.lineHeight,slots:s.slots});
const toEa=(d:Draft)=>({formationKey:d.formation,buildUp:d.buildUp,lineHeight:d.lineHeight,roleIds:d.slots.map(s=>s.ea)});
const summary=(s:Squad)=>formationByKey(s.formation)?.positions.map((p,i)=>{const o=optionsFor(p.pos).find(x=>x.id===s.slots[i]?.ea);return `${p.pos} ${o?roleName(o):'?'}`;}).join(' · ')??'';

export default function SquadBuilder({state}:{state:AppState|null}){
  const tid=state?.tournament?.id;
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<Draft>(blank(0)),[pick,setPick]=useState(0),[importUgs,setImportUgs]=useState(''),[importEa,setImportEa]=useState(''),[others,setOthers]=useState('');
  const load=useCallback(async()=>{if(!tid)return;try{const d=await api<Data>(`tournament/${tid}/squads`);setData(d);return d;}catch(e){setError((e as Error).message);}},[tid]);
  useEffect(()=>{void load().then(d=>{const s=d?.squads.find(x=>x.mine&&x.slotNo===0);if(s)setDraft(fromSquad(s));});},[load]);
  const mine=useMemo(()=>data?.squads.filter(s=>s.mine)??[],[data]);
  const layout=useMemo(()=>layoutFor(draft.formation),[draft.formation]);
  // The EA code is recomputed from the encoded settings whenever any of them changes. Player names and the tactic name are not part of it.
  const ea=useMemo(()=>{try{return {code:encodeTactic(toEa(draft)),error:''};}catch(e){return {code:'',error:(e as Error).message};}},[draft]);
  if(!tid)return <Empty title="Create a tournament first" description="The squad builder belongs to a tournament."/>;
  if(!data)return <section className="panel">{error?<p className="inline-error" role="alert">{error}</p>:<p className="fine-print">Loading…</p>}</section>;
  const setOpen=async(open:boolean)=>{setBusy(true);setError('');try{await api(`tournament/${tid}/squads/open`,{open});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  if(!data.open)return <section className="panel sq-locked"><LockKeyhole size={28}/><h2>Opens after the draw</h2><p className="fine-print">Once managers are drawn to their clubs, you can build your starting tactic and up to four squad tactics here.</p>{error&&<p className="inline-error" role="alert">{error}</p>}{data.isOwner&&<><button className="btn lime" disabled={busy} onClick={()=>void setOpen(true)}>Open squads now</button><p className="fine-print">Organizer only. Managers can start preparing before the draw. You can close it again until the draw happens.</p></>}</section>;
  const edit=(patch:Partial<Draft>)=>setDraft(d=>({...d,...patch}));
  const setSlot=(i:number,patch:Partial<Slot>)=>setDraft(d=>({...d,slots:d.slots.map((s,j)=>j===i?{...s,...patch}:s)}));
  function changeFormation(key:string){
    const next=formationByKey(key),prev=formationByKey(draft.formation);if(!next||!prev)return;
    const m=remapRoles(draft.formation,draft.slots.map(s=>s.ea),key);
    // player names follow their position type, in the same order, so they are never attached to a different kind of position
    const pool=new Map<string,string[]>();prev.positions.forEach((p,i)=>pool.set(p.pos,[...(pool.get(p.pos)??[]),draft.slots[i].player]));
    const slots=next.positions.map((p,i)=>({ea:m.roleIds[i],player:pool.get(p.pos)?.shift()??''}));
    const lost=[...pool.values()].flat().filter(Boolean).length;
    setDraft(d=>({...d,formation:key,slots}));setPick(0);setError('');
    setNote([m.reset.length?`Roles reset to the starting point for: ${m.reset.join(', ')} (the new formation does not offer the same role there).`:'',lost?`${lost} player name${lost===1?'':'s'} had no matching position and ${lost===1?'was':'were'} removed.`:''].filter(Boolean).join(' '));
  }
  function open(slotNo:number){const s=mine.find(x=>x.slotNo===slotNo);setDraft(s?fromSquad(s):blank(slotNo));setPick(0);setNote('');setError('');}
  async function act(path:string,body:unknown,done:string,after?:()=>Promise<void>|void){setBusy(true);setError('');setNote('');try{await api(`tournament/${tid}/squads${path}`,body);setNote(done);await load();await after?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const save=()=>act('',{slotNo:draft.slotNo,name:draft.name,formation:draft.formation,buildUp:draft.buildUp,lineHeight:draft.lineHeight,slots:draft.slots,version:draft.version},'Saved.',async()=>{const d=await load();const s=d?.squads.find(x=>x.mine&&x.slotNo===draft.slotNo);if(s)setDraft(fromSquad(s));});
  const remove=()=>draft.id&&act('/delete',{id:draft.id},'Deleted.',()=>setDraft(blank(draft.slotNo)));
  const share=toShareCode({name:draft.name,formationKey:draft.formation,buildUp:draft.buildUp,lineHeight:draft.lineHeight,slots:draft.slots});
  const copy=(t:string)=>{void navigator.clipboard?.writeText(t).then(()=>setNote('Copied.'),()=>setNote('Copy failed. Select the code and copy it by hand.'));};
  function importEaCode(){
    try{
      const t=decodeTactic(importEa);
      // Every encoded setting comes from the code. Player names are app-only: kept only when the formation is unchanged.
      setDraft(d=>({...d,formation:t.formationKey,buildUp:t.buildUp,lineHeight:t.lineHeight,slots:t.roleIds.map((id,i)=>({ea:id,player:t.formationKey===d.formation?d.slots[i]?.player??'':''}))}));
      setImportEa('');setPick(0);setError('');setNote(`Imported ${formationLabel(t.formationKey)}, ${t.buildUp}, line height ${t.lineHeight} and all eleven roles. Player names are not part of EA codes${t.formationKey===draft.formation?' and were kept':' and were cleared because the formation changed'}. Press Save to keep it.`);
    }catch(e){setError(`EA code: ${(e as Error).message}`);}
  }
  function importUgsCode(){
    try{
      const s=fromShareCode(importUgs);
      validateTactic({formationKey:s.formationKey,buildUp:s.buildUp as BuildUp,lineHeight:s.lineHeight,roleIds:s.slots.map(x=>x.ea)});
      setDraft(d=>({...d,name:s.name.slice(0,40)||d.name,formation:s.formationKey,buildUp:s.buildUp as BuildUp,lineHeight:s.lineHeight,slots:s.slots.map(x=>({ea:x.ea,player:x.player.slice(0,40)}))}));
      setImportUgs('');setPick(0);setError('');setNote('Imported. Check it and press Save.');
    }catch(e){setError(`UGS code: ${(e as Error).message}`);}
  }
  const f=formationByKey(draft.formation)!,sel=f.positions[pick],selSlot=draft.slots[pick];
  const viewed=data.squads.filter(s=>!s.mine&&s.ownerName===others),owners=[...new Set(data.squads.filter(s=>!s.mine).map(s=>s.ownerName))];
  return <div className="sq-wrap">
    {error&&<p className="inline-error" role="alert">{error}</p>}{note&&<p className="fine-print" role="status">{note}</p>}
    {data.openedEarly&&<section className="panel"><p className="fine-print">Opened early by the organizer, before the draw.{data.isOwner&&<> <button className="text-btn" disabled={busy} onClick={()=>void setOpen(false)}>Close squads again</button></>}</p></section>}
    {!data.canBuild&&<section className="panel"><p className="fine-print">Only managers can build squads. You can browse other managers' tactics below.</p></section>}
    {data.canBuild&&<div className="sq-grid">
      <section className="panel sq-pitch-panel">
        <div className="sq-top"><label>Formation<select value={draft.formation} onChange={e=>changeFormation(e.target.value)}>{FORMATIONS.map(x=><option key={x.key} value={x.key}>{formationLabel(x.key)}</option>)}</select></label>
          <label>Build-up<select value={draft.buildUp} onChange={e=>edit({buildUp:e.target.value as BuildUp})}>{BUILD_UP_NAMES.map(b=><option key={b}>{b}</option>)}</select></label>
          <label>Line height ({draft.lineHeight})<input type="range" min={1} max={100} value={draft.lineHeight} onChange={e=>edit({lineHeight:Number(e.target.value)})}/></label></div>
        <div className="sq-pitch" aria-label="Pitch">{f.positions.map((p,i)=>{const o=optionsFor(p.pos).find(x=>x.id===draft.slots[i].ea);return <button type="button" key={i} className={`sq-card${i===pick?' on':''}`} style={{left:`${layout[i].x}%`,top:`${layout[i].y}%`}} onClick={()=>setPick(i)}>
          <small>{draft.slots[i].player||'—'}</small><b>{o?roleName(o):'?'}</b><span>{o?.focus}</span><em>{p.pos}</em></button>;})}</div>
        <div className="sq-edit"><b>{sel.pos}</b>
          <label>Role and focus<select value={selSlot.ea} onChange={e=>setSlot(pick,{ea:Number(e.target.value)})}>{optionsFor(sel.pos).map(o=><option key={o.id} value={o.id}>{optionLabel(o)}</option>)}</select></label>
          <label>Player (app only, optional)<input value={selSlot.player} maxLength={40} onChange={e=>setSlot(pick,{player:e.target.value})}/></label></div>
        <p className="fine-print">New tactics start from a plain starting point for each position. It is not an optimized setup, so choose the roles you want.</p>
      </section>
      <aside className="panel sq-side">
        <div className="section-heading"><h2>Tactics</h2></div>
        {data.myClubs.length>0&&<p className="fine-print">Your clubs: {data.myClubs.join(', ')}</p>}
        {[0,1,2,3,4].map(n=>{const s=mine.find(x=>x.slotNo===n);return <button type="button" key={n} className={`sq-slot${draft.slotNo===n?' on':''}`} onClick={()=>open(n)}>{s?<><b>{s.name}</b><small>{formationLabel(s.formation)} · {s.buildUp}</small></>:<><Plus size={16}/> {n===0?'Starting tactic':`Squad tactic ${n}`}</>}</button>;})}
        <label>Name (app only)<input value={draft.name} maxLength={40} onChange={e=>edit({name:e.target.value})}/></label>
        <label>EA FC tactic code (generated)<input readOnly value={ea.code} onFocus={e=>e.currentTarget.select()}/></label>
        {ea.error&&<p className="inline-error">{ea.error}</p>}
        <button className="btn secondary" disabled={!ea.code} onClick={()=>copy(ea.code)}><Copy size={15}/> Copy EA code</button>
        <p className="fine-print">Built from formation, build-up, line height and the eleven roles only. Not yet confirmed to import in the game.</p>
        <label>Import an EA code<input value={importEa} maxLength={12} spellCheck={false} onChange={e=>setImportEa(e.target.value)} placeholder="12 characters"/></label>
        <button className="btn secondary" disabled={importEa.trim().length===0} onClick={importEaCode}>Import EA code</button>
        <div className="sq-actions"><button className="btn lime" disabled={busy||!draft.name.trim()||!ea.code} onClick={()=>void save()}>Save</button>{draft.id&&<button className="btn secondary" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> Delete</button>}</div>
        <label>UGS share code (includes names)<input readOnly value={share} onFocus={e=>e.currentTarget.select()}/></label>
        <button className="btn secondary" onClick={()=>copy(share)}><Copy size={15}/> Copy share code</button>
        <label>Import a UGS code<input value={importUgs} onChange={e=>setImportUgs(e.target.value)} placeholder="UGS2.…"/></label>
        <button className="btn secondary" disabled={!importUgs.trim()} onClick={importUgsCode}>Import UGS code</button>
      </aside>
    </div>}
    <section className="panel"><div className="section-heading"><h2>Other managers' tactics</h2></div>
      {owners.length===0?<p className="fine-print">Nobody else has saved a tactic yet.</p>:<><select value={others} onChange={e=>setOthers(e.target.value)}><option value="">Choose a manager</option>{owners.map(o=><option key={o}>{o}</option>)}</select>
        <div className="sq-others">{viewed.map(s=><article key={s.id} className="tp-tie"><header><span>{s.slotNo===0?'Starting':`Squad ${s.slotNo}`}</span><b>{formationLabel(s.formation)}</b></header><p><b>{s.name}</b> · {s.buildUp} · height {s.lineHeight}</p>{s.clubs.length>0&&<p className="fine-print">{s.clubs.join(', ')}</p>}<p className="fine-print">{summary(s)}</p><p><code>{s.eaCode}</code> <button className="text-btn" onClick={()=>copy(s.eaCode)}>Copy</button></p></article>)}</div></>}
    </section>
  </div>;
}

'use client';
import {useRef,useState} from 'react';
import {Camera,Plus,Trash2,Users, Pencil} from 'lucide-react';
import {api,Empty,type AppState} from './ui';

const initials=(n:string)=>n.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()??'').join('')||'?';
export function PlayerPhoto({id,name,version,size=44}:{id:string;name:string;version?:number|null;size?:number}){
  const [failed,setFailed]=useState(false),style={width:size,height:size,fontSize:Math.round(size*0.4)};
  if(version==null||failed)return <span className="avatar avatar-initials" style={style} aria-hidden="true">{initials(name)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="avatar" style={style} src={`/api/player-photo/${encodeURIComponent(id)}?v=${version}`} alt="" width={size} height={size} onError={()=>setFailed(true)}/>;
}
/** Centre-crops to a square and re-encodes as a 256x256 JPEG data URL in the browser. The server re-checks it. */
async function squareJpeg(file:File):Promise<string>{
  const bitmap=await createImageBitmap(file),side=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot resize pictures.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();
  return canvas.toDataURL('image/jpeg',0.88);
}

export function PlayerAdmin({state,onRefresh}:{state:AppState|null;onRefresh:()=>Promise<unknown>}){
  const [name,setName]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState('');
  const pick=useRef<HTMLInputElement>(null),target=useRef('');
  const t=state?.tournament,players=(state?.players??[]).filter(p=>p.name.toLowerCase().includes(search.trim().toLowerCase()));
  if(!t||state?.member?.role!=='admin')return <Empty title="Admins only" description="Only the organizer can manage players and photos."/>;
  async function run(key:string,work:()=>Promise<unknown>){setBusy(key);setError('');try{await work();await onRefresh();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
  const add=()=>run('add',async()=>{await api(`tournament/${t.id}/players`,{name});setName('');});
  const upload=(file?:File)=>{const pid=target.current;if(!file||!pid)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setError('Use a JPEG, PNG or WebP picture.');return;}
    void run(pid,async()=>{await api(`tournament/${t.id}/player-photo`,{playerId:pid,image:await squareJpeg(file)});if(pick.current)pick.current.value='';});};
  const remove=(pid:string)=>run(pid,()=>api(`tournament/${t.id}/player-photo`,{playerId:pid,image:null}));
  const rename=(pid:string,current:string)=>{
    const next=window.prompt('Player name',current);
    if(next==null||!next.trim()||next.trim()===current)return;
    void run(pid,()=>api(`tournament/${t.id}/players/update`,{playerId:pid,name:next.trim()}));
  };
  const setIn=(pid:string,inTournament:boolean)=>run(pid,()=>api(`tournament/${t.id}/players/update`,{playerId:pid,inTournament}));
  const deletePlayer=(pid:string,playerName:string)=>{
    if(!window.confirm(`Delete ${playerName} from the player list? Their photo and unused manager slots will also be removed.`))return;
    void run(pid,async()=>{
      try{await api(`tournament/${t.id}/players/delete`,{playerId:pid,name:playerName});}
      catch(e){
        if((e as Error&{status?:number}).status!==409||(e as Error).message.includes('not found'))throw e;
        if(!window.confirm(`${(e as Error).message}\n\nDelete ${playerName} anyway?\n\nThis removes their player assignment, club assignment, playoff spots and ALL their matches in every tournament. Their login and membership remain. It cannot be undone.`))throw e;
        await api(`tournament/${t.id}/players/delete`,{playerId:pid,name:playerName,force:true});
      }
    });
  };
  return <>
    <div className="competition-intro"><div><span className="eyebrow">ADMIN · PLAYERS</span><h2>Players and photos</h2><p>{(state?.players??[]).length} players · Rename players, choose who plays in the tournament, add photos, or delete a player.</p></div><Users size={34}/></div>
    <section className="panel player-add"><div><h3>Add a player</h3><p>Players can enter playoffs without an assigned club. Authorize their email in Tournament setup.</p></div>
      <form onSubmit={e=>{e.preventDefault();void add();}}><label className="field">Player / gamer name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label><button className="btn primary" disabled={!name.trim()||busy==='add'}><Plus size={16}/>{busy==='add'?'Adding…':'Add player'}</button></form></section>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <input ref={pick} className="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label="Choose a player photo" onChange={e=>upload(e.target.files?.[0])}/>
    <section className="panel pa-list"><label className="field pa-search">Search players<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a player"/></label>
      {!players.length?<p className="muted">No players yet.</p>:players.map(p=>{const v=state?.playerPhotos?.[p.id];return <div className="pa-row" key={p.id}>
        <PlayerPhoto id={p.id} name={p.name} version={v} size={48}/><span className="pa-name"><b>{p.name}</b><label className="pa-switch"><input type="checkbox" role="switch" checked={p.in_tournament!==0} disabled={busy===p.id} onChange={e=>void setIn(p.id,e.target.checked)}/><span>{p.in_tournament===0?'Just following':'Plays in the tournament'}</span></label></span>
        <div className="pa-actions"><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>rename(p.id,p.name)} aria-label={`Rename ${p.name}`}><Pencil size={15}/>Rename</button><button type="button" className="btn secondary" disabled={busy===p.id} onClick={()=>{target.current=p.id;pick.current?.click();}}><Camera size={15}/>{busy===p.id?'Saving…':v==null?'Add photo':'Change photo'}</button>
          {v!=null&&<button type="button" className="btn secondary" disabled={!!busy} onClick={()=>void remove(p.id)}><Trash2 size={15}/>Remove photo</button>}
          <button type="button" className="btn secondary" disabled={!!busy} onClick={()=>deletePlayer(p.id,p.name)} aria-label={`Delete player ${p.name}`}><Trash2 size={15}/>Delete player</button></div></div>;})}
    </section>
  </>;
}

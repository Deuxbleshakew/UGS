'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './ui';

type Info={hasAvatar:boolean;version:number;width:number|null;height:number|null;size:number|null};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()??'').join('')||'?';

/** Small round picture, or initials when the person has not set one. `version` null/undefined means no picture. */
export function Avatar({id,name,version,size=40}:{id:string;name:string;version?:number|null;size?:number}){
  const [failed,setFailed]=useState(false);
  const style={width:size,height:size,fontSize:Math.round(size*0.4)};
  if(version==null||failed)return <span className="avatar avatar-initials" style={style} aria-hidden="true">{initials(name)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="avatar" style={style} src={`/api/avatar/${encodeURIComponent(id)}?v=${version}`} alt="" width={size} height={size} onError={()=>setFailed(true)}/>;
}

/** Centre-crops to a square and re-encodes as a 256x256 JPEG in the browser. The server re-checks the file; this only keeps uploads small and strips camera metadata. */
async function squareJpeg(file:File):Promise<Blob>{
  const bitmap=await createImageBitmap(file);
  const side=Math.min(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot resize pictures.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);
  ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare that picture.')),'image/jpeg',0.9));
}

export default function AvatarPicker({userId,name}:{userId:string;name:string}){
  const [info,setInfo]=useState<Info|null>(null),[pending,setPending]=useState<{blob:Blob;url:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const load=useCallback(async()=>{try{setInfo(await api<Info>('avatar'));}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>()=>{if(pending)URL.revokeObjectURL(pending.url);},[pending]);
  async function choose(file:File|undefined){
    setError('');setMessage('');if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setError('Use a JPEG, PNG or WebP picture.');return;}
    if(file.size>15*1024*1024){setError('That picture is too large. Choose one under 15 MB.');return;}
    try{const blob=await squareJpeg(file);setPending({blob,url:URL.createObjectURL(blob)});}catch(e){setError((e as Error).message||'That picture could not be read.');}
  }
  async function save(){
    if(!pending)return;setBusy(true);setError('');
    try{const form=new FormData();form.append('file',new File([pending.blob],'avatar.jpg',{type:'image/jpeg'}));setInfo(await api<Info>('avatar',form));setPending(null);setMessage('Picture saved.');if(input.current)input.current.value='';}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function remove(){
    setBusy(true);setError('');
    try{setInfo(await api<Info>('avatar',{},'DELETE'));setMessage('Picture removed.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel profile-panel avatar-picker" aria-labelledby="avatar-heading">
    <h2 id="avatar-heading">Profile picture</h2>
    <div className="avatar-row">
      {pending?/* eslint-disable-next-line @next/next/no-img-element */<img className="avatar" style={{width:96,height:96}} src={pending.url} alt="Preview of your new picture"/>:<Avatar id={userId} name={name} version={info?.hasAvatar?info.version:null} size={96}/>}
      <div>
        <p className="avatar-hint">Optional. It is cropped to a square and shown to other signed-in members, for example on friendly invitations. JPEG, PNG or WebP.</p>
        <input ref={input} className="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void choose(e.target.files?.[0])} aria-label="Choose a profile picture" tabIndex={-1}/>
        <div className="sched-actions avatar-actions">
          {!pending&&<button type="button" className="btn primary" disabled={busy} onClick={()=>input.current?.click()}>{info?.hasAvatar?'Change picture':'Choose picture'}</button>}
          {pending&&<><button type="button" className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save picture'}</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>{setPending(null);if(input.current)input.current.value='';}}>Cancel</button></>}
          {!pending&&info?.hasAvatar&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>void remove()}>Remove picture</button>}
        </div>
      </div>
    </div>
    {message&&<p className="notice" role="status">{message}</p>}
    {error&&<p className="inline-error" role="alert">{error}</p>}
  </section>;
}

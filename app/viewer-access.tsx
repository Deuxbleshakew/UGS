'use client';
import {useState,type FormEvent} from 'react';
import {api} from './ui';

export default function ViewerAccess({tournamentId,onRefresh}:{tournamentId:string;onRefresh:()=>Promise<unknown>}) {
  const [name,setName]=useState(''),[username,setUsername]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState('');
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setLink('');setMessage('');
    try{
      const result=await api<{token:string|null;username:string}>(`tournament/${tournamentId}/viewers`,{name,username});
      if(result.token)setLink(window.location.origin+'/activate#token='+result.token);
      setMessage(`@${result.username} has viewer access to this tournament. ${result.token?'Share this private link and username; it expires in 72 hours.':'They can use their existing password.'}`);
      await onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="viewer-access"><h3 className="form-section-title">Invite a viewer</h3>
    <p>Viewers can browse this tournament’s fixtures, official results, standings and awards. They cannot report matches or open private screenshot evidence. Inviting a viewer does not add them to Elo rankings.</p>
    <form onSubmit={event=>void save(event)}>
      <label className="field">Display name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} disabled={busy}/></label>
      <label className="field">Username<input value={username} onChange={e=>setUsername(e.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} disabled={busy}/></label>
      <p className="fine-print">Use an existing username to grant that account access. Existing participant assignments are preserved. Reissuing a pending username replaces its previous activation link.</p>
      <button className="btn secondary" disabled={busy}>{busy?'Saving…':'Grant viewer access'}</button>
    </form>
    {error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
    {link&&<label className="field">Private activation link<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
  </section>;
}

'use client';
import {useEffect,useState} from 'react';
import {api} from './ui';

export type DiscordStatus={configured:boolean;linked?:{name:string;linkedAt:string}|null;inviteUrl?:string|null;redirectUri?:string|null};

// Fixed result codes from /api/discord/callback; the server never reflects free text into the URL.
export const discordMessages:Record<string,{text:string;error?:boolean}>={
  linked:{text:'Discord connected. You can now also sign in with Discord.'},
  signed_in:{text:'Signed in with Discord.'},
  cancelled:{text:'Discord connection was cancelled. Nothing changed.'},
  expired:{text:'That Discord request expired or was opened in another browser. Please start again.',error:true},
  failed:{text:'Discord could not be reached or did not confirm your account. Please try again.',error:true},
  in_use:{text:'That Discord account is already connected to a different UGS account.',error:true},
  already_linked:{text:'Your UGS account is already connected to a different Discord account. Disconnect it first.',error:true},
  not_linked:{text:'That Discord account is not connected to a UGS account. Sign in with your username, then connect Discord from My Profile.',error:true},
  session_changed:{text:'You were signed out or switched accounts while connecting Discord. Sign in and try again.',error:true},
  unavailable:{text:'Discord sign-in is not set up yet. Use your username and password.',error:true},
};
/** Reads (and removes) the ?discord= result code so a refresh does not repeat the message. */
export function takeDiscordResult(){
  if(typeof window==='undefined')return null;
  const url=new URL(window.location.href),code=url.searchParams.get('discord');
  if(!code)return null;
  url.searchParams.delete('discord');window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  return discordMessages[code]??null;
}

export default function DiscordConnection(){
  const [status,setStatus]=useState<DiscordStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{text:string;error?:boolean}|null>(null);
  useEffect(()=>{setResult(takeDiscordResult());api<DiscordStatus>('discord/status').then(setStatus).catch(e=>setError((e as Error).message));},[]);
  async function connect(){
    setBusy(true);setError('');
    try{const {url}=await api<{url:string}>('discord/link',{});window.location.assign(url);}
    catch(e){setError((e as Error).message);setBusy(false);}
  }
  async function disconnect(){
    if(!window.confirm('Disconnect Discord? You will still sign in with your username and password.'))return;
    setBusy(true);setError('');
    try{await api('discord/unlink',{});setStatus(s=>s&&{...s,linked:null});setResult({text:'Discord disconnected.'});}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel profile-panel discord-connection" aria-labelledby="discord-heading">
    <h2 id="discord-heading">Discord connection</h2>
    <p>Optional. Connecting lets you also sign in with Discord. It does not change your access, roles, tournaments or watchroom permissions, and your username and password keep working.</p>
    {result&&<p className={'notice'+(result.error?' error':'')} role={result.error?'alert':'status'}>{result.text}</p>}
    {!status?<p className="fine-print">Loading…</p>
      :!status.configured?<>
        <p className="notice">Discord connection is not set up yet.</p>
        {status.redirectUri!==undefined&&<p className="fine-print">Owner setup: register this exact redirect URI in the Discord application, then add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to the server environment: <code>{status.redirectUri??'set APP_ORIGIN first'}</code></p>}
      </>
      :status.linked?<>
        <p>Connected as <b>{status.linked.name}</b> since {new Date(status.linked.linkedAt).toLocaleDateString()}.</p>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>void disconnect()}>Disconnect Discord</button>
      </>
      :<button type="button" className="btn primary" disabled={busy} onClick={()=>void connect()}>{busy?'Opening Discord…':'Connect Discord'}</button>}
    {status?.inviteUrl&&<p><a className="text-btn" href={status.inviteUrl} target="_blank" rel="noopener noreferrer">Join the UGS Discord</a> <span className="fine-print">Joining the server is separate from your UGS account.</span></p>}
    {error&&<p className="notice error" role="alert">{error}</p>}
  </section>;
}

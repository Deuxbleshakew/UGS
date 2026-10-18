"use client";
import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from "react";
import {clubBadge} from '@/lib/club-badges';
import {crestUrl} from '@/lib/asset-teams';
import {useFootballers,findFootballer,findAnywhere,HEAD_COLS,HEAD_CELL} from '@/lib/footballers';
import {Shield,ClipboardList,X,ChevronRight,Flame} from "lucide-react";
import type {MatchQuality} from '@/lib/match-quality';
import {countryName} from '@/lib/countries';
import {statusNames,type Config,type Fixture,type awards} from "@/lib/domain";
import {fixtureSide,stageLabel,type CommunityPlayer,type EloRow,type Playoff} from '@/lib/competition';
import type {AccountAccessRow} from '@/lib/account-access';
import type {ProfileState} from '@/lib/profile';
import type {Matchweeks} from '@/lib/matchweeks';
export type User={userId:string;displayName:string;email:string;username:string|null;isOwner:boolean};
export type Member={id:string;user_id:string|null;email:string;username:string|null;name:string;role:string;manager_id:string|null;player_id?:string|null};
export type Audit={id:string;actor_name:string;at:string;action:string;reason:string;before:string;after:string};
export type AppState={countries?:Record<string,string>;matchweeks?:Matchweeks;profile?:ProfileState;onboardingRequired?:boolean;user:User;tournaments:{id:string;name:string;role:string}[];tournament:null|{id:string;name:string;config:Config;locked_at:string|null;awards:ReturnType<typeof awards>|null};member?:Member;fixtures?:Fixture[];members?:Member[];audit?:Audit[];players?:CommunityPlayer[];rankings?:EloRow[];clubStars?:Record<string,number>;playerPhotos?:Record<string,number>;season?:{start:string|null;end:string|null};playoffs?:Playoff[];accountAccess?:AccountAccessRow[]};
export const colors=["#283c8b","#e54d54","#39726b","#bd8a28","#7256aa","#3b71a9"];
export function Crest({club,small=false}:{club?:{id:string;name:string;shortName?:string};small?:boolean}){
  const local=crestUrl(club?.name),badge=clubBadge(club?.name),[failed,setFailed]=useState<string[]>([]);
  const src=[local,badge].find(u=>u&&!failed.includes(u));
  const hash=[...(club?.id??"")].reduce((a,b)=>a+b.charCodeAt(0),0);
  if(src)return <span className={`crest club-badge ${small?"small":""}`}><img src={src} alt={`${club?.name} badge`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(f=>[...f,src])} style={{width:'100%',height:'100%',objectFit:'contain'}}/></span>;
  return <span className={`crest ${small?"small":""}`} style={{"--club":colors[hash%colors.length]} as CSSProperties}><Shield size={small?27:42} strokeWidth={1.5}/><b>{club?.shortName?.slice(0,3)??club?.name.slice(0,3).toUpperCase()??"FC"}</b></span>;
}
/** Head photo of a real footballer from the asset pack, found by club and typed name. Renders nothing when there is no match (free-typed names, clubs outside the pack). */
import noHead from "@/lib/assets/heads-missing.json";
export function PlayerFace({club,name,size=32}:{club?:string;name?:string;size?:number}){
  const roster=useFootballers(),hit=club===undefined?findAnywhere(roster,name):findFootballer(roster,club,name);
  if(!hit||(noHead as Record<string,number[]>)[hit.teamId]?.includes(hit.index))return null;
  const col=hit.index%HEAD_COLS,row=Math.floor(hit.index/HEAD_COLS),k=size/HEAD_CELL;
  return <span className="player-face" aria-hidden="true" style={{width:size,height:size,backgroundImage:`url(/heads/${hit.teamId}.webp)`,backgroundSize:`${HEAD_COLS*HEAD_CELL*k}px auto`,backgroundPosition:`-${col*size}px -${row*size}px`}}/>;
}
export function Flag({code,className=''}:{code?:string;className?:string}){
  if(!code)return null;const name=countryName(code);
  return <svg className={`flag ${className}`} role="img" aria-label={name} width={18} height={12} viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><title>{name}</title><use href={`/flags/sprite.svg#${code.toLowerCase()}`}/></svg>;
}
export function Status({status}:{status:string}){return <span className={`status ${status}`}><i/>{statusNames[status]??status}</span>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}){return <div className="empty"><span className="empty-icon"><ClipboardList size={27}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;}
export const fmt=(date:string|null)=>date?new Date(date).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"Not scheduled";
export const number=(n:number)=>Number.isInteger(n)?String(n):n.toFixed(2);
export async function api<T=Record<string,unknown>>(path:string,data?:unknown,method="POST"):Promise<T>{
  const response=await fetch('/api/'+path,data===undefined?{cache:"no-store"}:{method,headers:data instanceof FormData?{}:{"Content-Type":"application/json"},body:data instanceof FormData?data:JSON.stringify(data)});
  let result;try{result=await response.json();}catch{throw new Error("The server is unavailable. Please reload and try again.");}
  if(!response.ok)throw new Error(String((result as {error?:string})?.error??"The request could not be completed."));return result as T;
}
export function Modal({title,subtitle,onClose,wide=false,children}:{title:string;subtitle?:string;onClose:()=>void;wide?:boolean;children:ReactNode}){
  const box=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow="hidden";box.current?.focus();
    const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")close.current();if(e.key==="Tab"){
      const items=box.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]');
      if(!items?.length)return;const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===box.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }};
    document.addEventListener("keydown",handler);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",handler);prior?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide?"wide":""}`}><header><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X/></button></header>{children}</div></div>;
}
export function FixtureList({rows,config,players=[],onOpen,compact=false,quality}:{rows:Fixture[];config:Config;players?:CommunityPlayer[];onOpen:(f:Fixture)=>void;compact?:boolean;quality?:(f:Fixture)=>MatchQuality|null}){
  return rows.length?<div className={`fixture-list ${compact?'compact':''}`}>{rows.map(f=>{const home=fixtureSide(f,'home',config,players),away=fixtureSide(f,'away',config,players);return <button key={f.id} className="fixture-row" onClick={()=>onOpen(f)}><div className="match-meta"><span>{stageLabel(f)}</span><small>{fmt(f.scheduled)}</small>{(q=>q&&q.tier!=='standard'?<em className={`mq mq-${q.tier}`} title={`Game quality ${q.score}/100 · ${q.detail}`}>{q.tier==='big'&&<Flame size={12}/>}{q.tier==='big'?'Big match':'Good match'}<small>{q.detail}</small></em>:null)(quality?.(f)??null)}</div><div className="match-teams"><span><Crest club={home} small/>{home.name}</span><strong className={f.status==='finalized'?'score official':'score'}>{f.report?`${f.report.homeScore} : ${f.report.awayScore}`:'vs'}</strong><span><Crest club={away} small/>{away.name}</span></div><Status status={f.status}/><ChevronRight size={17}/></button>;})}</div>:<Empty title="The fixture list is waiting" description="Import the league draw, create player playoffs, or schedule your first fixture."/>;
}

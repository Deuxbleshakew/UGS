'use client';
import {useEffect,useState} from 'react';
import {assetTeamId,assetTeams,normalizeName} from './asset-teams';
// Real footballers from the owner's FC DB Editor asset pack, grouped by club. Loaded on demand (about 70 KB) so pages that never show a footballer do not pay for it.
// Row: [head id, display name, shirt number, position, overall, nation]. Row order is the order of the head sprite sheet cells.
export type Row=[number,string,number,string,number,string];
export type Roster=Record<string,Row[]>;
export const HEAD_COLS=10,HEAD_CELL=64;
let cached:Roster|null=null,pending:Promise<Roster>|null=null;
export function loadFootballers():Promise<Roster>{
  return pending??=import('./assets/footballers.json').then(m=>{cached=(m.default as unknown) as Roster;return cached;});
}
/** The asset-pack roster, or null while it loads. */
export function useFootballers():Roster|null{
  const [r,setR]=useState<Roster|null>(cached);
  useEffect(()=>{if(!r)loadFootballers().then(setR).catch(()=>{});},[r]);
  return r;
}
export function clubSquad(r:Roster|null,clubName:string|undefined):{id:string;rows:Row[]}|null{
  const id=assetTeamId(clubName);return r&&id&&r[id]?{id,rows:r[id]}:null;
}
/** Finds a typed name in a club's squad: exact name first, then a unique surname/first-name match ("Haaland"). */
export function findFootballer(r:Roster|null,clubName:string|undefined,typed:string|undefined):{teamId:string;index:number;row:Row}|null{
  const sq=clubSquad(r,clubName);const t=normalizeName(typed);if(!sq||!t)return null;
  const names=sq.rows.map(x=>normalizeName(x[1]));
  let i=names.indexOf(t);
  if(i<0){const hits=names.map((n,k)=>n.endsWith(' '+t)||n.startsWith(t+' ')?k:-1).filter(k=>k>=0);if(hits.length===1)i=hits[0];}
  return i<0?null:{teamId:sq.id,index:i,row:sq.rows[i]};
}
export const squadLabel=(x:Row)=>`#${x[2]} ${x[3]} · ${x[4]}`;
export const assetTeamName=(id:string)=>[...(assetTeams[id]??[])].sort((a,b)=>b.length-a.length)[0]??id;
/** Squad-builder lookup with no club chosen: an exact full-name match, only when exactly one footballer in the pack has that name. */
export function findAnywhere(r:Roster|null,typed:string|undefined):{teamId:string;index:number;row:Row}|null{
  const t=normalizeName(typed);if(!r||!t)return null;let found:{teamId:string;index:number;row:Row}|null=null;
  for(const [teamId,rows] of Object.entries(r))rows.forEach((row,index)=>{if(normalizeName(row[1])===t){if(found)found={teamId:'',index:-1,row};else found={teamId,index,row};}});
  const f=found as {teamId:string;index:number;row:Row}|null;return f&&f.index>=0?f:null;
}

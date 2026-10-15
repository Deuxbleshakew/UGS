// Pure helpers shared by server and browser. Kickoffs are always stored as UTC ISO strings;
// a profile timezone is only used to read and write wall-clock times.
const parts=(ms:number,tz:string)=>{
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second);
};
/** Offset of the zone from UTC in ms at the given instant. */
export const zoneOffset=(ms:number,tz:string)=>parts(Math.floor(ms/1000)*1000,tz)-Math.floor(ms/1000)*1000;
export function validTimezone(tz:string){try{new Intl.DateTimeFormat('en',{timeZone:tz});return !!tz;}catch{return false;}}
export type ZonedResult={ok:true;utc:string}|{ok:false;reason:'format'|'timezone'|'nonexistent'|'ambiguous'};
/** Converts 'YYYY-MM-DDTHH:mm' wall-clock time in `tz` to a UTC ISO string. Clock-change gaps and repeats are rejected, never guessed. */
export function zonedLocalToUtc(local:string,tz:string):ZonedResult{
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);if(!m)return {ok:false,reason:'format'};
  if(!validTimezone(tz))return {ok:false,reason:'timezone'};
  const [y,mo,d,h,mi]=m.slice(1).map(Number),guess=Date.UTC(y,mo-1,d,h,mi);
  const check=new Date(guess);if(check.getUTCFullYear()!==y||check.getUTCMonth()!==mo-1||check.getUTCDate()!==d||h>23||mi>59)return {ok:false,reason:'format'};
  const offsets=[...new Set([zoneOffset(guess-864e5,tz),zoneOffset(guess+864e5,tz)])];
  const hits=offsets.map(o=>guess-o).filter((u,i)=>zoneOffset(u,tz)===offsets[i]);
  if(hits.length===0)return {ok:false,reason:'nonexistent'};
  if(new Set(hits).size>1)return {ok:false,reason:'ambiguous'};
  return {ok:true,utc:new Date(hits[0]).toISOString()};
}
export const zoneMessages={format:'Enter a valid date and time.',timezone:'The saved timezone is not valid. Update it in My Profile.',nonexistent:'That local time does not exist because the clocks change then. Choose another time.',ambiguous:'That local time happens twice because the clocks change then. Choose another time.'} as const;
/** Wall-clock 'YYYY-MM-DDTHH:mm' of a UTC instant in `tz` (for datetime-local inputs). */
export function utcToZonedLocal(iso:string,tz:string){return new Date(parts(new Date(iso).getTime(),tz)).toISOString().slice(0,16);}
export function formatInZone(iso:string,tz:string|undefined){
  return new Intl.DateTimeFormat(undefined,{timeZone:tz||undefined,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));
}

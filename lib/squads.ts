import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {BUILD_UP_NAMES,encodeTactic,TacticCodeError,type BuildUp} from './eafc-tactics';

// Squad builder. Locked until the draw has assigned managers to clubs. Players may only edit their own tactics.
type Actor={userId:string;displayName:string};
type Who={role:string;managerId:string|null};
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const db=()=>database() as DatabaseSync,nowIso=()=>new Date().toISOString();
function tx<T>(fn:(d:DatabaseSync)=>T):T{const d=db();d.exec('BEGIN IMMEDIATE');try{const r=fn(d);d.exec('COMMIT');return r;}catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}}
const saveSchema=z.object({
  slotNo:z.number().int().min(0).max(4),
  name:z.string().trim().min(1,'Give the tactic a name.').max(40),
  formation:z.string().min(1).max(20),
  buildUp:z.enum(BUILD_UP_NAMES),
  lineHeight:z.number().int().min(1).max(100),
  slots:z.array(z.object({ea:z.number().int().min(0).max(15),player:z.string().trim().max(40)})).length(11),
  version:z.number().int().min(1).optional(),
});
const openSchema=z.object({open:z.boolean()});
const deleteSchema=z.object({id:z.string().min(1)});
type Config={clubs?:{id:string;name:string;manager?:string}[];managers?:{id:string;name:string}[]};
function config(d:DatabaseSync,tid:string):Config{
  const t=d.prepare('SELECT config FROM tournaments WHERE id=?').get(tid) as {config:string}|undefined;
  if(!t)fail('Tournament not found.',404);
  try{return JSON.parse(t!.config) as Config;}catch{return {};}
}
export const drawDone=(c:Config)=>!!c.clubs?.some(x=>x.manager);
const openedEarly=(d:DatabaseSync,tid:string)=>(d.prepare('SELECT open FROM squad_access WHERE tournament_id=?').get(tid) as {open:number}|undefined)?.open===1;
const isOpen=(d:DatabaseSync,tid:string,c:Config)=>drawDone(c)||openedEarly(d,tid);
const canBuild=(w:Who)=>w.role==='admin'||w.role==='manager';
export function listSquads(tid:string,actor:Actor,who:Who){
  const d=db(),c=config(d,tid),drawn=drawDone(c),open=isOpen(d,tid,c);
  const clubs=(id:string|null)=>id?(c.clubs??[]).filter(x=>x.manager===id).map(x=>x.name):[];
  const rows=open?d.prepare('SELECT s.*,a.name AS owner_name,m.manager_id FROM squads s JOIN accounts a ON a.id=s.owner_id LEFT JOIN members m ON m.tournament_id=s.tournament_id AND m.user_id=s.owner_id WHERE s.tournament_id=? ORDER BY a.name,s.slot_no').all(tid) as Record<string,unknown>[]:[];
  return {
    drawn,open,openedEarly:!drawn&&open,isOwner:who.role==='admin',canBuild:open&&canBuild(who),myClubs:clubs(who.managerId),
    squads:rows.flatMap(r=>{
      // The EA code is recomputed from the stored fields, never trusted from storage. Rows that no longer validate (for example
      // saved by an earlier version of the builder) are left out rather than shown wrongly.
      try{
        const slots=JSON.parse(String(r.slots)) as {ea:number;player:string}[];
        const eaCode=encodeTactic({formationKey:String(r.formation),buildUp:r.build_up as BuildUp,lineHeight:Number(r.line_height),roleIds:slots.map(x=>x.ea)});
        return [{id:r.id,slotNo:r.slot_no,name:r.name,formation:r.formation,buildUp:r.build_up,lineHeight:r.line_height,slots,eaCode,version:r.version,mine:r.owner_id===actor.userId,ownerName:r.owner_name,clubs:clubs(r.manager_id as string|null),updatedAt:r.updated_at}];
      }catch{return [];}
    }),
  };
}
export function saveSquad(tid:string,actor:Actor,who:Who,input:unknown){
  const data=saveSchema.parse(input);
  // The EA-facing fields are validated against the configuration (formation, build-up, height, a valid role/focus per position)
  // and the EA code is generated on the server from them. Player names stay app-only.
  let eaCode:string;
  try{eaCode=encodeTactic({formationKey:data.formation,buildUp:data.buildUp as BuildUp,lineHeight:data.lineHeight,roleIds:data.slots.map(x=>x.ea)});}
  catch(e){fail(e instanceof TacticCodeError?e.message:'This tactic could not be validated.');}
  return tx(d=>{
    if(!isOpen(d,tid,config(d,tid)))fail('The squad builder opens after the draw.',403);
    if(!canBuild(who))fail('Only managers can build squads.',403);
    const at=nowIso();
    let old=d.prepare('SELECT id,version,formation,build_up,line_height,slots FROM squads WHERE tournament_id=? AND owner_id=? AND slot_no=?').get(tid,actor.userId,data.slotNo) as {id:string;version:number;formation:string;build_up:string;line_height:number;slots:string}|undefined;
    if(old){ // a row saved by an earlier builder that no longer validates is invisible to its owner, so it is replaced rather than blocking the slot
      try{encodeTactic({formationKey:old.formation,buildUp:old.build_up as BuildUp,lineHeight:old.line_height,roleIds:(JSON.parse(old.slots) as {ea:number}[]).map(x=>x.ea)});}
      catch{d.prepare('DELETE FROM squads WHERE id=?').run(old.id);old=undefined;}
    }
    const slots=JSON.stringify(data.slots);
    if(old){
      if(data.version!==old.version)fail('This tactic changed. Reload and try again.',409);
      d.prepare('UPDATE squads SET name=?,formation=?,build_up=?,line_height=?,slots=?,ea_code=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(data.name,data.formation,data.buildUp,data.lineHeight,slots,eaCode,at,old.id,old.version);
      return {id:old.id};
    }
    const id=randomUUID();
    d.prepare('INSERT INTO squads(id,tournament_id,owner_id,slot_no,name,formation,build_up,line_height,slots,ea_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,tid,actor.userId,data.slotNo,data.name,data.formation,data.buildUp,data.lineHeight,slots,eaCode,at,at);
    return {id};
  });
}
export function deleteSquad(tid:string,actor:Actor,who:Who,input:unknown){
  const data=deleteSchema.parse(input);
  return tx(d=>{
    const s=d.prepare('SELECT id,owner_id FROM squads WHERE id=? AND tournament_id=?').get(data.id,tid) as {id:string;owner_id:string}|undefined;
    if(!s)fail('Tactic not found.',404);
    if(s!.owner_id!==actor.userId&&who.role!=='admin')fail('You can only delete your own tactics.',403);
    d.prepare('DELETE FROM squads WHERE id=?').run(data.id);
    return {ok:true};
  });
}

// Organizer only: open the builder before the draw (or close it again while the draw has not happened).
export function setSquadsOpen(tid:string,actor:Actor,who:Who,input:unknown){
  const {open}=openSchema.parse(input);
  if(who.role!=='admin')fail('Only the organizer can do that.',403);
  return tx(d=>{
    const t=d.prepare('SELECT owner_id FROM tournaments WHERE id=?').get(tid) as {owner_id:string}|undefined;
    if(!t||t.owner_id!==actor.userId)fail('Only the organizer can do that.',403);
    if(drawDone(config(d,tid)))fail('The draw has happened, so the squad builder is already open.',409);
    const at=nowIso();
    d.prepare('INSERT INTO squad_access(tournament_id,open,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(tournament_id) DO UPDATE SET open=excluded.open,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(tid,open?1:0,actor.userId,at);
    d.prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),tid,actor.userId,actor.displayName,at,open?'open-squads':'close-squads',open?'Organizer opened the squad builder before the draw.':'Organizer closed the squad builder again.','null',JSON.stringify({open}));
    return {open};
  });
}

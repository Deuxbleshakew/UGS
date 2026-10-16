import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';

export const TIQUICIA_POSITIONS=['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST'] as const;
type Actor={userId:string;isOwner:boolean};
const db=()=>database() as DatabaseSync;
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
const player=z.object({
  name:z.string().trim().min(1,'Enter a name.').max(60),
  position:z.enum(TIQUICIA_POSITIONS),
  gamertag:z.string().trim().max(40).default(''),
  shirtNumber:z.number().int().min(1).max(99).nullable().default(null),
});
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('add')}).merge(player),
  z.object({action:z.literal('update'),id:z.string().min(1)}).merge(player),
  z.object({action:z.literal('remove'),id:z.string().min(1)}),
]);
type Row={id:string;name:string;position:string;gamertag:string;shirt_number:number|null};
export function listTiquicia(){
  return (db().prepare('SELECT id,name,position,gamertag,shirt_number FROM tiquicia_players ORDER BY CASE position WHEN \'GK\' THEN 0 WHEN \'CB\' THEN 1 WHEN \'LB\' THEN 1 WHEN \'RB\' THEN 1 WHEN \'CDM\' THEN 2 WHEN \'CM\' THEN 2 WHEN \'CAM\' THEN 2 WHEN \'LM\' THEN 2 WHEN \'RM\' THEN 2 ELSE 3 END,name COLLATE NOCASE').all() as Row[])
    .map(r=>({id:r.id,name:r.name,position:r.position,gamertag:r.gamertag,shirtNumber:r.shirt_number}));
}
export function changeTiquicia(actor:Actor,raw:unknown){
  if(!actor.isOwner)fail('Only the organizer can change the RB Tiquicia roster.',403);
  const data=input.parse(raw),d=db();
  d.exec('BEGIN IMMEDIATE');
  try{
    if(data.action==='remove'){
      if(d.prepare('DELETE FROM tiquicia_players WHERE id=?').run(data.id).changes!==1)fail('Player not found.',404);
    }else{
      if(data.shirtNumber!=null){
        const clash=d.prepare('SELECT id,name FROM tiquicia_players WHERE shirt_number=?').get(data.shirtNumber) as {id:string;name:string}|undefined;
        if(clash&&(data.action==='add'||clash.id!==data.id))fail(`Number ${data.shirtNumber} already belongs to ${clash.name}.`,409);
      }
      const dup=d.prepare('SELECT id FROM tiquicia_players WHERE lower(name)=lower(?)').get(data.name) as {id:string}|undefined;
      if(dup&&(data.action==='add'||dup.id!==data.id))fail('A player with that name is already on the roster.',409);
      if(data.action==='add')d.prepare('INSERT INTO tiquicia_players(id,name,position,gamertag,shirt_number,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),data.name,data.position,data.gamertag,data.shirtNumber,actor.userId,new Date().toISOString());
      else if(d.prepare('UPDATE tiquicia_players SET name=?,position=?,gamertag=?,shirt_number=? WHERE id=?').run(data.name,data.position,data.gamertag,data.shirtNumber,data.id).changes!==1)fail('Player not found.',404);
    }
    d.exec('COMMIT');
  }catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}
  return {players:listTiquicia()};
}

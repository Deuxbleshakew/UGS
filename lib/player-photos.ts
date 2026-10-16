import type {DatabaseSync} from 'node:sqlite';
import {database} from '@/scripts/local-store.mjs';
import {AccountAccessError} from './account-access';
import {imageInfo,AVATAR_STORED_LIMIT,AVATAR_MIN_SIDE,AVATAR_MAX_SIDE} from './avatar-server';

const db=()=>database() as DatabaseSync;
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}

/** Version number per player who has a photo, for the players the organizer owns. */
export function photoVersions(ownerId:string):Record<string,number>{
  const r=db().prepare('SELECT p.player_id AS id,p.version FROM player_photos p JOIN community_players c ON c.id=p.player_id WHERE c.owner_id=?').all(ownerId) as {id:string;version:number}[];
  return Object.fromEntries(r.map(x=>[x.id,x.version]));
}
export function getPlayerPhoto(playerId:string){
  const r=db().prepare('SELECT mime,data,version FROM player_photos WHERE player_id=?').get(playerId) as {mime:string;data:Uint8Array;version:number}|undefined;
  return r?{mime:r.mime,data:r.data,version:r.version,size:r.data.byteLength}:null;
}
/** Organizer/admin only (the route checks the role). The server re-checks the real file signature and size. */
export function setPlayerPhoto(ownerId:string,playerId:string,bytes:Uint8Array|null){
  if(!db().prepare('SELECT id FROM community_players WHERE id=? AND owner_id=?').get(playerId,ownerId))fail('Player not found.',404);
  if(bytes===null){db().prepare('DELETE FROM player_photos WHERE player_id=?').run(playerId);return {version:null};}
  if(bytes.byteLength<64||bytes.byteLength>AVATAR_STORED_LIMIT)fail('Choose a smaller picture (under 512 KB after resizing).');
  const info=imageInfo(bytes);
  if(!info)fail('Use a JPEG, PNG or WebP picture.');
  if(info.width<AVATAR_MIN_SIDE||info.height<AVATAR_MIN_SIDE||info.width>AVATAR_MAX_SIDE||info.height>AVATAR_MAX_SIDE)fail('The picture size is not supported.');
  const at=new Date().toISOString();
  db().prepare('INSERT INTO player_photos(player_id,mime,data,width,height,version,updated_at) VALUES(?,?,?,?,?,1,?) ON CONFLICT(player_id) DO UPDATE SET mime=excluded.mime,data=excluded.data,width=excluded.width,height=excluded.height,version=player_photos.version+1,updated_at=excluded.updated_at').run(playerId,info.mime,bytes,info.width,info.height,at);
  return {version:(db().prepare('SELECT version FROM player_photos WHERE player_id=?').get(playerId) as {version:number}).version};
}

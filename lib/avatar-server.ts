import {database} from '@/scripts/local-store.mjs';
import type {DatabaseSync} from 'node:sqlite';
import {AccountAccessError} from './account-access';

// Profile pictures. The browser crops and re-encodes to a small square, but the server never trusts that:
// it checks the real file signature, reads the true pixel size and refuses anything else (SVG, GIF, animated WebP, renamed files).
export const AVATAR_UPLOAD_LIMIT=1024*1024,AVATAR_STORED_LIMIT=512*1024,AVATAR_MIN_SIDE=16,AVATAR_MAX_SIDE=1024,AVATAR_COOLDOWN_MS=10_000;
const db=()=>database() as DatabaseSync;
function fail(m:string,s=400):never{throw new AccountAccessError(m,s);}
export type ImageInfo={mime:'image/jpeg'|'image/png'|'image/webp';width:number;height:number};
/** Reads type and size from the file header itself. Returns null when it is not a plain JPEG, PNG or still WebP. */
export function imageInfo(b:Uint8Array):ImageInfo|null{
  const ascii=(s:number,e:number)=>String.fromCharCode(...b.slice(s,e));
  if(b.length>=24&&b[0]===137&&ascii(1,4)==='PNG'&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10&&ascii(12,16)==='IHDR'){
    const v=new DataView(b.buffer,b.byteOffset,b.byteLength);return {mime:'image/png',width:v.getUint32(16),height:v.getUint32(20)};
  }
  if(b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255){
    let i=2;
    while(i+9<b.length){
      if(b[i]!==255){i++;continue;}
      const m=b[i+1];
      if(m===255){i++;continue;}
      if(m===0xd8||m===0x01||(m>=0xd0&&m<=0xd7)){i+=2;continue;}
      const len=(b[i+2]<<8)|b[i+3];
      if(m>=0xc0&&m<=0xcf&&m!==0xc4&&m!==0xc8&&m!==0xcc)return {mime:'image/jpeg',height:(b[i+5]<<8)|b[i+6],width:(b[i+7]<<8)|b[i+8]};
      if(len<2)return null;i+=2+len;
    }
    return null;
  }
  if(b.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
    const kind=ascii(12,16);
    if(kind==='VP8 '&&b[23]===0x9d&&b[24]===0x01&&b[25]===0x2a)return {mime:'image/webp',width:(b[26]|(b[27]<<8))&0x3fff,height:(b[28]|(b[29]<<8))&0x3fff};
    if(kind==='VP8L'&&b[20]===0x2f)return {mime:'image/webp',width:1+(b[21]|((b[22]&0x3f)<<8)),height:1+((b[22]>>6)|(b[23]<<2)|((b[24]&0x0f)<<10))};
    if(kind==='VP8X'){if(b[20]&0x02)return null;return {mime:'image/webp',width:1+(b[24]|(b[25]<<8)|(b[26]<<16)),height:1+(b[27]|(b[28]<<8)|(b[29]<<16))};}
  }
  return null;
}
export function getAvatar(accountId:string){
  const r=db().prepare('SELECT mime,data,version FROM account_avatars WHERE account_id=?').get(accountId) as {mime:string;data:Uint8Array;version:number}|undefined;
  return r?{mime:r.mime,data:r.data,version:r.version,size:r.data.byteLength}:null;
}
export function avatarVersion(accountId:string):number|null{
  return (db().prepare('SELECT version FROM account_avatars WHERE account_id=?').get(accountId) as {version:number}|undefined)?.version??null;
}
export function avatarInfo(accountId:string){
  const r=db().prepare('SELECT mime,length(data) AS size,width,height,version,updated_at FROM account_avatars WHERE account_id=?').get(accountId) as {mime:string;size:number;width:number;height:number;version:number;updated_at:string}|undefined;
  return {hasAvatar:!!r,version:r?.version??0,width:r?.width??null,height:r?.height??null,size:r?.size??null,updatedAt:r?.updated_at??null};
}
export function saveAvatar(accountId:string,bytes:Uint8Array){
  if(bytes.byteLength<64||bytes.byteLength>AVATAR_STORED_LIMIT)fail('Choose a smaller picture (under 512 KB after resizing).');
  const info=imageInfo(bytes);
  if(!info)fail('Use a JPEG, PNG or WebP picture. SVG, GIF and renamed files are not accepted.');
  if(info.width<AVATAR_MIN_SIDE||info.height<AVATAR_MIN_SIDE||info.width>AVATAR_MAX_SIDE||info.height>AVATAR_MAX_SIDE)fail(`The picture must be between ${AVATAR_MIN_SIDE} and ${AVATAR_MAX_SIDE} pixels on each side.`);
  const d=db();d.exec('BEGIN IMMEDIATE');
  try{
    const prev=d.prepare('SELECT updated_at,version FROM account_avatars WHERE account_id=?').get(accountId) as {updated_at:string;version:number}|undefined;
    if(prev&&Date.now()-new Date(prev.updated_at).getTime()<AVATAR_COOLDOWN_MS)fail('Please wait a few seconds before changing your picture again.',429);
    const now=new Date().toISOString();
    if(prev)d.prepare('UPDATE account_avatars SET mime=?,data=?,width=?,height=?,version=version+1,updated_at=? WHERE account_id=?').run(info.mime,bytes,info.width,info.height,now,accountId);
    else d.prepare('INSERT INTO account_avatars(account_id,mime,data,width,height,version,updated_at) VALUES(?,?,?,?,?,1,?)').run(accountId,info.mime,bytes,info.width,info.height,now);
    d.exec('COMMIT');
  }catch(e){if(d.isTransaction)d.exec('ROLLBACK');throw e;}
  return avatarInfo(accountId);
}
export function removeAvatar(accountId:string){db().prepare('DELETE FROM account_avatars WHERE account_id=?').run(accountId);return avatarInfo(accountId);}

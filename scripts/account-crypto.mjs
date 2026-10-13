import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function hashPassword(password){
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password,stored){
  const parts=(stored||'').split('$');
  const valid=parts.length===3&&parts[0]==='scrypt'&&/^[a-f0-9]{32}$/.test(parts[1])&&/^[a-f0-9]{64}$/.test(parts[2]);
  // Unknown accounts take the same expensive path as an incorrect password.
  const salt=valid?parts[1]:'00000000000000000000000000000000';
  const expected=Buffer.from(valid?parts[2]:'0'.repeat(64),'hex');
  const actual=await derive(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(actual,expected)&&valid;
}

import {database} from '@/scripts/local-store.mjs';
import type {Config} from './domain';
import {drawImported} from './draw-privacy';
import {isCountryCode} from './countries';

/** Country of origin per manager id / player id, from each account's own optional profile choice.
 *  Manager flags follow the same rule as manager names: nobody but the organizer sees them before the draw is published. */
export function memberCountries(tid:string,config:Config,isAdmin:boolean):Record<string,string>{
  const rows=database().prepare('SELECT m.manager_id,m.player_id,p.data FROM members m JOIN account_profiles p ON p.account_id=m.user_id WHERE m.tournament_id=?').all(tid) as {manager_id:string|null;player_id:string|null;data:string}[];
  const showManagers=isAdmin||drawImported(config),out:Record<string,string>={};
  for(const r of rows){
    let country:unknown;try{country=(JSON.parse(r.data) as {country?:unknown}).country;}catch{continue;}
    if(!isCountryCode(country))continue;
    if(r.manager_id&&showManagers)out[r.manager_id]=country;
    if(r.player_id)out[r.player_id]=country;
  }
  return out;
}

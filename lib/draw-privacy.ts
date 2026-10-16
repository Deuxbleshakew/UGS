import type {Config} from './domain';

/** Who manages which club stays secret until the draw is imported. Until then everyone except the organizer
 *  receives generic manager names, so the real names cannot be read from the page data or the API response. */
export const drawImported=(c:Config)=>!!c.clubs?.some(x=>x.manager);
export function maskUndrawnManagers(c:Config,isAdmin:boolean):Config{
  if(isAdmin||drawImported(c))return c;
  return {...c,managers:c.managers.map((m,i)=>({...m,name:`Manager ${i+1}`}))};
}

import {z} from 'zod';
export const teamSchema=z.object({kind:z.enum(['football','community']),name:z.string().trim().min(1).max(80)});
export const teamKey=(team:{kind:string;name:string})=>team.kind+':'+team.name.trim().toLowerCase();
export const profileSchema=z.object({
  displayName:z.string().trim().min(1).max(80),
  teams:z.array(teamSchema).max(30),primary:z.string().max(100).nullable(),
  platforms:z.array(z.enum(['PlayStation','PC','Xbox'])).max(3),
  timezone:z.string().trim().max(100).refine(value=>{if(!value)return true;try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Choose a valid timezone.'),
  psnId:z.string().trim().max(80),eaId:z.string().trim().max(80),
}).superRefine((value,ctx)=>{
  const keys=value.teams.map(teamKey);
  if(new Set(keys).size!==keys.length)ctx.addIssue({code:'custom',path:['teams'],message:'Remove duplicate teams.'});
  if(value.primary&&!keys.includes(value.primary))ctx.addIssue({code:'custom',path:['primary'],message:'Your primary favorite must be a followed team.'});
  if(new Set(value.platforms).size!==value.platforms.length)ctx.addIssue({code:'custom',path:['platforms'],message:'Remove duplicate platforms.'});
});
export type ProfileData=z.infer<typeof profileSchema>;
export type ProfileState={data:ProfileData;version:number;participant:boolean;missing:string[];complete:boolean};
export function missingProfile(data:ProfileData,username:string|null,participant:boolean){
  const missing:string[]=[];
  if(!username)missing.push('Ask the owner to assign your username');
  if(!data.displayName.trim())missing.push('Display name');
  if(!data.teams.length)missing.push('At least one followed team');
  if(participant){
    if(!data.platforms.length)missing.push('Gaming platform');
    if(!data.timezone)missing.push('Timezone');
    if(data.platforms.includes('PlayStation')&&!data.psnId)missing.push('PlayStation Online ID');
    if(data.platforms.some(p=>p==='PC'||p==='Xbox')&&!data.eaId)missing.push('EA ID');
  }
  return missing;
}

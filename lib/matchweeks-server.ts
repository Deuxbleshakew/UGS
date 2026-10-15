import {database} from '@/scripts/local-store.mjs';
import {z} from 'zod';
import {AccountAccessError} from './account-access';
import type {Matchweeks} from './matchweeks';
type Control={current_week:number;version:number};
export function getMatchweeks(tid:string):Matchweeks{
 const db=database(),control=db.prepare('SELECT * FROM matchweek_control WHERE tournament_id=?').get(tid) as Control|undefined;
 const rows=db.prepare("SELECT matchday AS week,COUNT(*) AS total,SUM(CASE WHEN status='finalized' THEN 1 ELSE 0 END) AS finalized FROM fixtures WHERE tournament_id=? AND kind='club' AND stage='league' GROUP BY matchday ORDER BY matchday").all(tid) as {week:number;total:number;finalized:number}[];
 const weeks=rows.map(w=>({...w,outstanding:w.total-w.finalized,locked:!!control&&w.week>control.current_week}));
 const current=weeks.find(w=>w.week===control?.current_week);
 return {enabled:!!control,currentWeek:control?.current_week??null,version:control?.version??0,weeks,canAdvance:!!current&&current.total>0&&current.outstanding===0&&weeks.some(w=>w.week===current.week+1)};
}
export function requireOpenMatchweek(tid:string,f:{kind?:string;stage:string;matchday:number}){
 if(f.kind!=='club'||f.stage!=='league')return;
 const control=database().prepare('SELECT current_week FROM matchweek_control WHERE tournament_id=?').get(tid) as Control|undefined;
 if(control&&f.matchday>control.current_week)throw new AccountAccessError('This matchweek is locked. The owner must open it before results or proof can be submitted.',409);
}
export function changeMatchweeks(tid:string,actor:{userId:string;displayName:string},input:unknown){
 const data=z.object({action:z.enum(['enable','advance']),version:z.number().int().min(0),assignmentsReviewed:z.boolean().optional()}).parse(input);
 const db=database();db.exec('BEGIN IMMEDIATE');
 try{
  if(!db.prepare('SELECT t.id FROM tournaments t JOIN accounts a ON a.id=t.owner_id WHERE t.id=? AND t.owner_id=? AND a.owner=1 AND t.locked_at IS NULL').get(tid,actor.userId))throw new AccountAccessError('Only the owner can open matchweeks, and awards must be unlocked.',403);
  const before=getMatchweeks(tid);
  if(before.version!==data.version)throw new AccountAccessError('Matchweek state changed. Refresh before continuing.',409);
  if(data.action==='enable'){
   if(before.enabled)throw new AccountAccessError('Matchweek controls are already enabled.',409);
   if(!data.assignmentsReviewed)throw new AccountAccessError('Review and confirm the matchweek assignments first.');
   if(before.weeks.length<2||before.weeks.some((w,i)=>w.week!==i+1))throw new AccountAccessError('Assign fixtures to at least two consecutive matchweeks starting at 1.');
   const fixtures=db.prepare("SELECT id,home,away,matchday,status FROM fixtures WHERE tournament_id=? AND kind='club' AND stage='league'").all(tid) as {id:string;home:string;away:string;matchday:number;status:string}[];
   const seen=new Set<string>();
   for(const f of fixtures){for(const club of [f.home,f.away]){const key=f.matchday+':'+club;if(seen.has(key))throw new AccountAccessError('A club appears more than once in a matchweek. Review the imported assignments.');seen.add(key);}}
   if(fixtures.some(f=>f.matchday>1&&f.status!=='scheduled')||db.prepare("SELECT p.id FROM proofs p JOIN fixtures f ON f.id=p.fixture_id WHERE f.tournament_id=? AND f.kind='club' AND f.stage='league' AND f.matchday>1 LIMIT 1").get(tid))throw new AccountAccessError('Later weeks already contain reports or proof. Their history is preserved; controls cannot be activated on this calendar.');
   db.prepare('INSERT INTO matchweek_control VALUES(?,1,1,?)').run(tid,new Date().toISOString());
  }else{
   if(!before.enabled||!before.canAdvance)throw new AccountAccessError('Finalize every fixture in the current week and ensure the next week exists before opening it.',409);
   db.prepare('UPDATE matchweek_control SET current_week=current_week+1,version=version+1,updated_at=? WHERE tournament_id=?').run(new Date().toISOString(),tid);
  }
  const after=getMatchweeks(tid);
  db.prepare('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),tid,actor.userId,actor.displayName,new Date().toISOString(),'matchweeks-'+data.action,data.action==='enable'?'Owner reviewed calendar and enabled sequential weeks.':'Owner opened next week after all current results finalized.',JSON.stringify(before),JSON.stringify(after));
  db.prepare('UPDATE tournaments SET revision=revision+1 WHERE id=?').run(tid);
  db.exec('COMMIT');return after;
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
}

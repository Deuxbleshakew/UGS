import type {DatabaseSync} from 'node:sqlite';
import {database} from '@/scripts/local-store.mjs';
import type {EloResult} from './competition';

/** A friendly moves Elo by half as much as an official match. */
export const FRIENDLY_WEIGHT=0.5;

export type FriendlyEloState='counts'|'waiting'|'earlier'|'none';
type Evaluated={state:FriendlyEloState;needs:string|null;result?:EloResult};
type Ev={invitation_id:string;actor_id:string|null;at:string;action:string;reason:string|null};
type Body={inviter:{goals:number;stars:number|null};invitee:{goals:number;stars:number|null}};

const same=(a:Body,b:Body)=>a.inviter.goals===b.inviter.goals&&a.invitee.goals===b.invitee.goals&&(a.inviter.stars??null)===(b.inviter.stars??null)&&(a.invitee.stars??null)===(b.invitee.stars??null);
const parse=(text:string|null):Body|null=>{try{const b=JSON.parse(String(text)) as Body;return typeof b?.inviter?.goals==='number'&&typeof b?.invitee?.goals==='number'?b:null;}catch{return null;}};

/**
 * Which friendlies count. A score counts once BOTH players have entered or confirmed the same score,
 * or when the organizer entered it for two other players. Any later change that the other player has not
 * confirmed takes it out again until they do. Only scores agreed after Elo-for-friendlies began count.
 */
export function evaluateFriendlies():Map<string,Evaluated&{home:string;away:string}>{
  const d=database() as DatabaseSync,out=new Map<string,Evaluated&{home:string;away:string}>();
  const started=(d.prepare('SELECT started_at FROM friendly_elo_start WHERE id=1').get() as {started_at:string}|undefined)?.started_at;
  const owners=new Set((d.prepare('SELECT id FROM accounts WHERE owner=1').all() as {id:string}[]).map(r=>r.id));
  const invs=d.prepare("SELECT id,inviter_id,invitee_id,mode FROM friendly_invitations WHERE status='accepted'").all() as {id:string;inviter_id:string;invitee_id:string;mode:'clubs'|'ultimate'}[];
  const events=d.prepare("SELECT invitation_id,actor_id,at,action,reason FROM friendly_events WHERE action='result' AND invitation_id IN (SELECT id FROM friendly_invitations WHERE status='accepted') ORDER BY at,rowid").all() as Ev[];
  const byInv=new Map<string,Ev[]>();for(const e of events){const l=byInv.get(e.invitation_id)??[];l.push(e);byInv.set(e.invitation_id,l);}
  for(const inv of invs){
    const list=byInv.get(inv.id)??[];if(!list.length)continue;
    const last=list[list.length-1],body=parse(last.reason);if(!body)continue;
    const ownerEntry=!!last.actor_id&&owners.has(last.actor_id)&&last.actor_id!==inv.inviter_id&&last.actor_id!==inv.invitee_id;
    let at:string|null=null,state:FriendlyEloState='waiting',needs:string|null=null;
    if(ownerEntry)at=last.at;
    else{
      const other=last.actor_id===inv.inviter_id?inv.invitee_id:last.actor_id===inv.invitee_id?inv.inviter_id:null;
      const theirs=other?[...list].reverse().find(e=>e.actor_id===other):undefined,theirBody=theirs?parse(theirs.reason):null;
      if(other&&theirBody&&same(body,theirBody))at=last.at;else needs=other;
    }
    if(at){state=started&&at>=started?'counts':'earlier';}
    const result:EloResult|undefined=state==='counts'?{id:'friendly:'+inv.id,home:inv.inviter_id,away:inv.invitee_id,score:body.inviter.goals>body.invitee.goals?1:body.inviter.goals<body.invitee.goals?0:0.5,homeGoals:body.inviter.goals,awayGoals:body.invitee.goals,at:at!,order:0,homeStars:inv.mode==='clubs'?body.inviter.stars??undefined:undefined,awayStars:inv.mode==='clubs'?body.invitee.stars??undefined:undefined,weight:FRIENDLY_WEIGHT}:undefined;
    out.set(inv.id,{state,needs,result,home:inv.inviter_id,away:inv.invitee_id});
  }
  return out;
}

/** Elo results for the friendlies that count, with account ids swapped for player ids. */
export function friendlyPlayerIds():Map<string,string>{
  const d=database() as DatabaseSync,map=new Map<string,string>();
  for(const r of d.prepare('SELECT u.account_id AS a,u.player_id AS p FROM account_usernames u JOIN community_players p ON p.id=u.player_id WHERE u.account_id IS NOT NULL').all() as {a:string;p:string}[])map.set(r.a,r.p);
  for(const r of d.prepare('SELECT m.user_id AS a,m.player_id AS p FROM members m JOIN community_players p ON p.id=m.player_id WHERE m.user_id IS NOT NULL').all() as {a:string;p:string}[])if(!map.has(r.a))map.set(r.a,r.p);
  return map;
}
export function friendlyEloResults():EloResult[]{
  const map=friendlyPlayerIds();
  const out:EloResult[]=[];
  for(const {result} of evaluateFriendlies().values()){
    if(!result)continue;const home=map.get(result.home),away=map.get(result.away);
    if(!home||!away||home===away)continue;
    out.push({...result,home,away});
  }
  return out;
}

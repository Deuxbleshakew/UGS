import { z } from "zod";

export const configSchema = z.object({
  tournamentId:z.string().min(1).max(100), name:z.string().min(1).max(100),
  pots:z.array(z.object({id:z.string().min(1).max(80),name:z.string().max(80)})).min(1).max(16),
  managers:z.array(z.object({id:z.string().min(1).max(80),name:z.string().min(1).max(80)})).min(1).max(100),
  clubs:z.array(z.object({id:z.string().min(1).max(80),name:z.string().min(1).max(100),shortName:z.string().max(12).optional(),pot:z.string(),country:z.string().max(8).optional(),manager:z.string().optional()})).min(2).max(128),
  managerDraw:z.object({clubsPerManager:z.number().int().min(1).max(10),distinctPots:z.boolean()}).optional(),
  leaguePhase:z.object({homePerPot:z.number().int().min(0).max(10),awayPerPot:z.number().int().min(0).max(10),forbidSameManager:z.boolean(),forbidSameCountry:z.boolean().optional(),maxOpponentsPerCountry:z.number().int().min(0).max(128).optional()}).optional(),
}).superRefine((c,ctx)=>{
  for(const [label,items] of [["Club",c.clubs],["Manager",c.managers],["Pot",c.pots]] as const)
    if(new Set(items.map(x=>x.id)).size!==items.length)ctx.addIssue({code:"custom",message:`${label} IDs must be unique.`});
  for(const club of c.clubs){
    if(!c.pots.some(p=>p.id===club.pot))ctx.addIssue({code:"custom",message:`Unknown pot for ${club.name}.`});
    if(club.manager&&!c.managers.some(m=>m.id===club.manager))ctx.addIssue({code:"custom",message:`Unknown manager for ${club.name}.`});
  }
});
export type Config=z.infer<typeof configSchema>;
export const statisticFields=[
  ["possession","Possession","%"],["shots","Shots",""],["shotsOnTarget","Shots on target",""],["xg","Expected goals",""],
  ["passes","Passes attempted",""],["passesCompleted","Passes completed",""],["passAccuracy","Pass accuracy","%"],
  ["tackles","Tackles attempted",""],["tacklesWon","Tackles won",""],["interceptions","Interceptions",""],
  ["saves","Saves",""],["fouls","Fouls",""],["offsides","Offsides",""],["corners","Corners",""],
  ["freeKicks","Free kicks",""],["penaltiesAwarded","Penalties awarded",""],["penaltiesScored","Penalties scored",""],
  ["yellowCards","Yellow cards",""],["redCards","Red cards",""],
] as const;
const statKeys=statisticFields.map(f=>f[0]);
const statsSchema=z.record(z.string(),z.number().finite().min(0).max(10000)).superRefine((s,ctx)=>{
  for(const [k,v] of Object.entries(s)){
    if(!statKeys.includes(k as typeof statKeys[number]))ctx.addIssue({code:"custom",message:`Unknown statistic: ${k}`});
    if(["possession","passAccuracy"].includes(k)&&v>100)ctx.addIssue({code:"custom",message:`${k} must be between 0 and 100.`});
    if(!["possession","passAccuracy","xg"].includes(k)&&!Number.isInteger(v))ctx.addIssue({code:"custom",message:`${k} must be a whole number.`});
  }
});
export const eventSchema=z.object({clubId:z.string().min(1),player:z.string().trim().min(1).max(100),
  type:z.enum(["goal","assist","own-goal","yellow","red","penalty-goal","penalty-miss","player-of-match","rating"]),
  minute:z.number().int().min(0).max(150).optional(),rating:z.number().min(0).max(10).optional()});
export const reportSchema=z.object({homeScore:z.number().int().min(0).max(99),awayScore:z.number().int().min(0).max(99),
  playedAt:z.string().datetime(),rosterVersion:z.string().max(80).default("Not recorded"),
  home:statsSchema,away:statsSchema,events:z.array(eventSchema).max(300),notes:z.string().max(2000).default(""),
  shootout:z.object({home:z.number().int().min(0).max(99),away:z.number().int().min(0).max(99)}).optional()});
export type Report=z.infer<typeof reportSchema>;
export type MatchEvent=z.infer<typeof eventSchema>;
export type Fixture={id:string;tournament_id:string;home:string;away:string;stage:string;matchday:number;scheduled:string|null;status:string;report:Report|null;submitted_by:string|null;submitted_manager:string|null;submitted_at:string|null;finalized_at:string|null;note:string|null;version:number;kind?:'club'|'player';home_player_id?:string|null;away_player_id?:string|null;tie_id?:string|null;leg?:number|null;playoff_round?:number|null};
// Short chip labels. Longer explanations live in statusHelp() below so the wording stays consistent everywhere.
export const statusNames:Record<string,string>={scheduled:"Awaiting report",pending:"Awaiting opponent",confirmed:"Confirmed · awaiting admin",disputed:"Disputed",correction:"Correction requested",finalized:"Finalized"};
/** Labels for the admin Review page. "action" groups need an admin decision; "waiting" groups are waiting on someone else. */
export const reviewLabels={confirmed:"Ready to finalize",disputed:"Disputes to resolve",pending:"Awaiting opponent",correction:"Waiting on manager"} as const;
export type StatusViewer="admin"|"opponent"|"submitter"|"participant"|"observer";
export type StatusContext={awardsLocked?:boolean;weekLocked?:boolean};
/** Plain-language explanation of a result status for the person looking at it. Only describes rules the backend really enforces. */
export function statusHelp(status:string,viewer:StatusViewer,ctx:StatusContext={}):string{
  const admin=viewer==="admin",mgr=viewer!=="observer"&&!admin;
  const base:Record<string,string>={
    scheduled:admin||mgr?"No result has been submitted yet. Play the match, then submit the score with a final-score screenshot.":"No result has been submitted yet.",
    pending:admin?"Waiting for the opponent to confirm or dispute. You can finalize it, edit it or request a correction, but finalizing before the opponent confirms needs a reason."
      :viewer==="opponent"?"Check the score and the screenshot. Confirming accepts the score but does not make it official: an admin still has to finalize it. If it is wrong, dispute it and say why."
      :viewer==="submitter"?"Waiting for your opponent to confirm or dispute this report. It is not official yet."
      :mgr?"Waiting for the other manager to confirm or dispute this report. It is not official yet."
      :"Awaiting opponent response. This result is not official yet.",
    confirmed:admin?"The opponent confirmed the score. Check the proof, then finalize it to make it official."
      :mgr?"The opponent confirmed the score, but it is not official until an admin finalizes it."
      :"Confirmed by the opponent. Awaiting admin finalization. Not official yet.",
    disputed:admin?"The opponent disputed this result. Read their reason and check the proof, then finalize it, edit it or request a correction."
      :mgr?"The opponent disputed this result. An admin will review it. It is not official."
      :"Disputed. Awaiting admin review. Not official.",
    correction:admin?"A correction was requested. The report is waiting for a manager from either side, or an admin, to update and resubmit it."
      :mgr?"An admin asked for a correction. Update the report and resubmit it. Either manager can do this."
      :"A correction was requested. Awaiting an updated report.",
    finalized:"Official result. It counts toward the table and awards, and it cannot currently be reopened.",
  };
  let text=base[status]??"";
  if(status!=="finalized"&&ctx.weekLocked)text+=" This matchweek is locked, so nothing can be submitted or reviewed until the owner opens it.";
  else if(admin&&ctx.awardsLocked&&["pending","confirmed","disputed"].includes(status))text+=" Awards are locked, so unlock them before finalizing.";
  return text.trim();
}
/** What the stored note means. The note is overwritten by each action, so this only labels the cases the backend guarantees. */
// Only labels whose author and purpose the server guarantees. changeFixture is the only writer of status/note: dispute requires an opposing manager's non-empty reason,
// correction requires an admin's reason, and pending+note can only come from an admin edit (submit stores no note). Confirm/finalize notes may be a system default string, so they stay neutral.
export function noteLabel(status:string):string{
  return ({disputed:"Opponent's dispute reason",correction:"Admin's correction request",pending:"Organizer's edit reason",confirmed:"Result note",finalized:"Result note"} as Record<string,string>)[status]??"Result note";
}
export function warnings(r:Report,f?:Pick<Fixture,'home'|'away'>):string[]{
  const issues:string[]=[];
  if(r.home.possession!=null&&r.away.possession!=null&&Math.abs(r.home.possession+r.away.possession-100)>1)issues.push("Possession does not total 100% (±1%).");
  for(const [label,s,score] of [["Home",r.home,r.homeScore],["Away",r.away,r.awayScore]] as const){
    if(s.shotsOnTarget!=null&&s.shots!=null&&s.shotsOnTarget>s.shots)issues.push(`${label}: shots on target exceed total shots.`);
    if(s.shotsOnTarget!=null&&score>s.shotsOnTarget)issues.push(`${label}: goals exceed shots on target. Check for own goals or an unusual result.`);
    if(s.passesCompleted!=null&&s.passes!=null&&s.passesCompleted>s.passes)issues.push(`${label}: completed passes exceed attempted passes.`);
    if(s.tacklesWon!=null&&s.tackles!=null&&s.tacklesWon>s.tackles)issues.push(`${label}: tackles won exceed attempts.`);
    if(s.penaltiesScored!=null&&s.penaltiesAwarded!=null&&s.penaltiesScored>s.penaltiesAwarded)issues.push(`${label}: penalties scored exceed penalties awarded.`);
    if(f){
      const club=label==='Home'?f.home:f.away,opponent=label==='Home'?f.away:f.home;
      const events=r.events.filter(e=>e.clubId===club);
      const goals=events.filter(e=>['goal','penalty-goal'].includes(e.type)).length+r.events.filter(e=>e.clubId===opponent&&e.type==='own-goal').length;
      if(goals>score)issues.push(`${label}: recorded goal events exceed the score. Check for duplicate or own-goal events.`);
      if(events.filter(e=>e.type==='assist').length>score)issues.push(`${label}: recorded assists exceed the score.`);
      for(const [type,key] of [['yellow','yellowCards'],['red','redCards']] as const)
        if(s[key]!=null&&events.filter(e=>e.type===type).length>s[key])issues.push(`${label}: recorded ${type} cards exceed Match Facts.`);
    }
  }
  return issues;
}
export function validateMatchReport(r:Report,f:Fixture){
  if(r.events.some(e=>e.clubId!==f.home&&e.clubId!==f.away))throw new Error("An event belongs to a club outside this fixture.");
  if(r.events.some(e=>e.type==="rating"&&e.rating==null))throw new Error("Enter a value for every player rating.");
  const ratingKeys=r.events.filter(e=>e.type==="rating").map(e=>e.clubId+"/"+e.player.toLowerCase());
  if(new Set(ratingKeys).size!==ratingKeys.length)throw new Error("A player can have only one rating per match.");
  if(r.shootout&&!f.tie_id&&(f.stage!=="final"||r.homeScore!==r.awayScore||r.shootout.home===r.shootout.away))throw new Error("A shootout requires a tied final and different shootout scores.");
  if(f.stage==="final"&&r.homeScore===r.awayScore&&!r.shootout)throw new Error("Enter the shootout result for a tied final.");
}
export type Standing={id:string;name:string;shortName?:string;manager?:string;pot:string;played:number;wins:number;draws:number;losses:number;gf:number;ga:number;gd:number;points:number;cleanSheets:number;form:string[];last5:{result:'W'|'D'|'L';opponent:string;score:string;home:boolean}[];stats:Record<string,{total:number;count:number}>};
export function standings(config:Config,fixtures:Fixture[],stage="league"):Standing[]{
  const rows=new Map<string,Standing>(config.clubs.map(c=>[c.id,{...c,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,gd:0,points:0,cleanSheets:0,form:[],last5:[],stats:{}}]));
  const official=fixtures.filter(f=>f.kind!=='player'&&f.status==="finalized"&&f.report&&(stage==="all"||f.stage===stage)).sort((a,b)=>a.report!.playedAt.localeCompare(b.report!.playedAt));
  for(const f of official){const r=f.report!;
    for(const [id,score,conceded,stats] of [[f.home,r.homeScore,r.awayScore,r.home],[f.away,r.awayScore,r.homeScore,r.away]] as const){
      const row=rows.get(id);if(!row)continue;
      row.played++;row.gf+=score;row.ga+=conceded;row.gd=row.gf-row.ga;row.cleanSheets+=conceded===0?1:0;
      if(score>conceded){row.wins++;row.points+=3;row.form.push("W");}else if(score===conceded){row.draws++;row.points++;row.form.push("D");}else{row.losses++;row.form.push("L");}
      for(const [key,value] of Object.entries(stats)){const s=row.stats[key]??{total:0,count:0};s.total+=value;s.count++;row.stats[key]=s;}
      row.form=row.form.slice(-5);
      const opponentId=id===f.home?f.away:f.home,result=score>conceded?'W':score===conceded?'D':'L';
      row.last5.push({result,opponent:config.clubs.find(c=>c.id===opponentId)?.name??opponentId,score:`${score}-${conceded}`,home:id===f.home});
      row.last5=row.last5.slice(-5);
    }
  }
  return [...rows.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name));
}
export function managerRows(config:Config,fixtures:Fixture[]){
  const clubs=standings(config,fixtures);
  return config.managers.map(m=>{const own=clubs.filter(c=>c.manager===m.id);return {...m,clubs:own.length,played:own.reduce((s,c)=>s+c.played,0),points:own.reduce((s,c)=>s+c.points,0),wins:own.reduce((s,c)=>s+c.wins,0),gf:own.reduce((s,c)=>s+c.gf,0),gd:own.reduce((s,c)=>s+c.gd,0)};}).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.wins-a.wins);
}
export function playerRows(config:Config,fixtures:Fixture[]){
  const people=new Map<string,{name:string;clubId:string;club:string;goals:number;assists:number;rating:number;ratings:number;matches:Set<string>}>();
  for(const f of fixtures.filter(f=>f.kind!=='player'&&f.status==="finalized"&&f.report))for(const e of f.report!.events){
    const key=e.clubId+"/"+e.player.toLowerCase();const p=people.get(key)??{name:e.player,clubId:e.clubId,club:config.clubs.find(c=>c.id===e.clubId)?.name??e.clubId,goals:0,assists:0,rating:0,ratings:0,matches:new Set<string>()};
    if(["goal","penalty-goal"].includes(e.type))p.goals++;if(e.type==="assist")p.assists++;if(e.type==="rating"&&e.rating!=null){p.rating+=e.rating;p.ratings++;}p.matches.add(f.id);people.set(key,p);
  }
  return [...people.values()].map(p=>({...p,matches:p.matches.size,average:p.ratings?p.rating/p.ratings:null})).sort((a,b)=>b.goals-a.goals||b.assists-a.assists||a.name.localeCompare(b.name));
}
export function awards(config:Config,fixtures:Fixture[]){
  const all=standings(config,fixtures,"all").filter(c=>c.played),managers=managerRows(config,fixtures).filter(m=>m.played),players=playerRows(config,fixtures);
  function award(id:string,name:string,rule:string,unit:string,items:{name:string;value:number;detail:string;tie?:number}[],ascending=false){
    items.sort((a,b)=>(ascending?a.value-b.value:b.value-a.value)||(b.tie??0)-(a.tie??0));const leader=items[0];
    const leaders=leader?items.filter(i=>i.value===leader.value&&(i.tie??0)===(leader.tie??0)):[];
    return {id,name,rule,unit,leaders,entries:items.slice(0,5)};
  }
  return [
    award("attack","Best attack","Finalized matches · most goals, then highest goals per match. Equal leaders share the lead.","goals",all.map(c=>({name:c.name,value:c.gf,tie:c.gf/c.played,detail:`${c.played} matches · ${(c.gf/c.played).toFixed(2)} per match` }))),
    award("clean","Clean sheet club","Finalized matches · most clean sheets, then fewest goals conceded.","clean sheets",all.map(c=>({name:c.name,value:c.cleanSheets,tie:-c.ga,detail:`${c.ga} conceded · ${c.played} matches`}))),
    award("manager","Leading manager","League phase · combined points from all managed clubs, then goal difference. Equal leaders share the lead.","points",managers.map(m=>({name:m.name,value:m.points,tie:m.gd,detail:`${m.clubs} clubs · ${m.wins} wins`}))),
    award("boot","Golden Boot","Verified player events · goals (including penalty goals), then assists. Own goals excluded. Equal leaders share the lead.","goals",players.filter(p=>p.goals).map(p=>({name:p.name,value:p.goals,tie:p.assists,detail:p.club}))),
    award("assist","Playmaker","Verified player events · assists, then goals. Equal leaders share the lead.","assists",players.filter(p=>p.assists).map(p=>({name:p.name,value:p.assists,tie:p.goals,detail:p.club}))),
    award("rating","Player rating","Verified ratings · highest average, minimum 3 rated matches. Equal leaders share the lead.","rating",players.filter(p=>p.ratings>=3).map(p=>({name:p.name,value:p.average!,detail:`${p.club} · ${p.ratings} rated matches`}))),
  ];
}
export function csv(rows:Record<string,unknown>[]){
  if(!rows.length)return "No finalized records\r\n";
  const keys=Object.keys(rows[0]);const cell=(v:unknown)=>{let s=v==null?"":typeof v==="object"?JSON.stringify(v):String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return [keys.map(cell).join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\r\n");
}

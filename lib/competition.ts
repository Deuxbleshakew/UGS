import type { Config, Fixture, Report } from './domain';

export const ELO_START = 1000;
export const ELO_K = 32;
export type CommunityPlayer = { id:string; name:string; created_at:string };
export type EloResult = { id:string; home:string; away:string; score:number; at:string; order:number };
export type EloRow = CommunityPlayer & { rating:number; rank:number; played:number; wins:number; draws:number; losses:number; lastChange:number; peak:number; form:string[] };
export type SeededPlayer = { id:string; name:string; rating:number; seed:number };
export type PlayoffTie = { id:string; playoff_id:string; round:number; position:number; player_a:string; player_b:string|null };
export type Playoff = { id:string; tournament_id:string; name:string; target:number; elo_mode:'match'|'tie'; draw_seed:string; entrants:SeededPlayer[]; automatic_qualifiers:string[]; round:number; status:'active'|'complete'; qualified:string[]; version:number; created_at:string; ties:PlayoffTie[] };
export type TieResult = { complete:boolean; winner:string|null; a:number; b:number; penalties:boolean; bye:boolean };

// Finalized fixtures are the source of truth: recalculation cannot double-credit a result.
export function eloRankings(players:CommunityPlayer[], results:EloResult[]):EloRow[]{
  const rows=new Map<string,EloRow>(players.map(p=>[p.id,{...p,rating:ELO_START,rank:0,played:0,wins:0,draws:0,losses:0,lastChange:0,peak:ELO_START,form:[]}]));
  for(const match of [...results].sort((a,b)=>a.at.localeCompare(b.at)||a.order-b.order||a.id.localeCompare(b.id))){
    const home=rows.get(match.home),away=rows.get(match.away);
    if(!home||!away||home.id===away.id)continue;
    const expected=1/(1+10**((away.rating-home.rating)/400));
    const delta=Math.round(ELO_K*(match.score-expected)*1e6)/1e6;
    for(const [row,change,score] of [[home,delta,match.score],[away,-delta,1-match.score]] as const){
      row.rating=Math.round((row.rating+change)*1e6)/1e6;row.lastChange=change;row.peak=Math.max(row.peak,row.rating);row.played++;
      const outcome=score===1?'W':score===0?'L':'D';
      if(outcome==='W')row.wins++;else if(outcome==='L')row.losses++;else row.draws++;
      row.form=[...row.form,outcome].slice(-5);
    }
  }
  const sorted=[...rows.values()].sort((a,b)=>Number(b.played>0)-Number(a.played>0)||b.rating-a.rating||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  sorted.forEach((r,i)=>{r.rank=!r.played?0:i&&Math.abs(r.rating-sorted[i-1].rating)<1e-6?sorted[i-1].rank:i+1;});
  return sorted;
}

function drawHash(text:string){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0;}
export function seedPlayers(rows:Pick<EloRow,'id'|'name'|'rating'>[], seed:string):SeededPlayer[]{
  return [...rows].sort((a,b)=>b.rating-a.rating||drawHash(seed+'|'+a.id)-drawHash(seed+'|'+b.id)||a.id.localeCompare(b.id)).map((p,i)=>({...p,seed:i+1}));
}

// Highest seeds receive the necessary byes. Remaining seeds pair high versus low.
// The last qualifying round can stop at any number of places, including 12.
export function planRound(entrants:SeededPlayer[], target:number){
  if(!Number.isInteger(target)||target<1||target>=entrants.length)throw new Error('Choose fewer qualifying places than entrants.');
  const ordered=[...entrants].sort((a,b)=>a.seed-b.seed);
  const nextCount=Math.max(target,2**(Math.ceil(Math.log2(ordered.length))-1));
  const byeCount=2*nextCount-ordered.length;
  const byes=ordered.slice(0,byeCount),playing=ordered.slice(byeCount);
  return {nextCount,byes,pairs:Array.from({length:playing.length/2},(_,i)=>({higher:playing[i],lower:playing[playing.length-1-i]}))};
}

export function resolveTie(tie:PlayoffTie, fixtures:Fixture[]):TieResult{
  if(!tie.player_b)return {complete:true,winner:tie.player_a,a:0,b:0,penalties:false,bye:true};
  const legs=fixtures.filter(f=>f.tie_id===tie.id).sort((a,b)=>(a.leg??0)-(b.leg??0));
  let a=0,b=0;
  for(const f of legs){if(f.status!=='finalized'||!f.report)continue;const r=f.report;
    a+=f.home===tie.player_a?r.homeScore:r.awayScore;b+=f.home===tie.player_b?r.homeScore:r.awayScore;
  }
  const complete=legs.length===2&&legs.every(f=>f.status==='finalized'&&f.report)&&legs[0].leg===1&&legs[1].leg===2;
  if(!complete)return {complete:false,winner:null,a,b,penalties:false,bye:false};
  const second=legs[1],shootout=second.report!.shootout;
  const winner=a>b?tie.player_a:b>a?tie.player_b:shootout&&shootout.home!==shootout.away?(shootout.home>shootout.away?second.home:second.away):null;
  return {complete:!!winner,winner,a,b,penalties:a===b&&!!winner,bye:false};
}

export function checkPlayoffReport(report:Report, fixture:Fixture, allFixtures:Fixture[]){
  if(!fixture.tie_id)return;
  if(fixture.leg===1){if(report.shootout)throw new Error('Leg 1 can end in a draw. Penalties are only used after leg 2.');return;}
  const first=allFixtures.find(f=>f.tie_id===fixture.tie_id&&f.leg===1);
  if(!first?.report||first.status!=='finalized')throw new Error('Finalize leg 1 before reporting leg 2.');
  if(first.home!==fixture.away||first.away!==fixture.home)throw new Error('The two legs must reverse the home and away players.');
  const homeAggregate=report.homeScore+first.report.awayScore,awayAggregate=report.awayScore+first.report.homeScore;
  if(homeAggregate===awayAggregate){
    if(!report.shootout||report.shootout.home===report.shootout.away)throw new Error('Aggregate is tied. Include extra time in the leg 2 score, then enter the deciding penalties.');
  }else if(report.shootout)throw new Error('Only an aggregate tie can be decided by penalties. Away goals do not break ties.');
}

export function fixtureSide(f:Fixture, side:'home'|'away', config:Config, players:CommunityPlayer[]=[]){
  if(f.kind==='player'){
    const p=players.find(p=>p.id===f[side]);return {id:f[side],name:p?.name??'Player',shortName:p?.name,manager:undefined as string|undefined};
  }
  return config.clubs.find(c=>c.id===f[side])??{id:f[side],name:f[side],shortName:undefined,manager:undefined};
}
export function stageLabel(f:Fixture){return f.tie_id?`Playoffs · Round ${f.playoff_round??1} · Leg ${f.leg}`:f.stage==='final'?'Final':'League phase';}

import {standings, type Config, type Fixture, type Standing} from '@/lib/domain';

type Slot={label:string;club?:Standing;seed?:number};
const tbd=(label:string):Slot=>({label});
const seeded=(table:Standing[],n:number,live:boolean):Slot=>{const club=live?table[n-1]:undefined;return {label:club?.name??'TBD',club,seed:n};};

function Team({slot}:{slot:Slot}){return <div className={`kb-team${slot.club?'':' tbd'}`}>{slot.seed&&<span className="kb-seed">{slot.seed}</span>}<b>{slot.label}</b></div>;}
function Tie({a,b,note}:{a:Slot;b:Slot;note?:string}){return <div className="kb-tie"><Team slot={a}/><Team slot={b}/>{note&&<small>{note}</small>}</div>;}

export function KnockoutBracket({config,fixtures}:{config:Config;fixtures:Fixture[]}){
  const table=standings(config,fixtures,'league'),played=table.some(x=>x.played);
  if(config.clubs.length<24)return <section className="panel"><h2>Knockout bracket</h2><p className="muted">The bracket needs at least 24 clubs (8 direct places plus 16 playoff places).</p></section>;
  // Play-off ties pair 9 v 24, 10 v 23 … 16 v 17; winners meet the top eight, seed 1 facing the 16/17 winner.
  const po=Array.from({length:8},(_,i)=>({a:seeded(table,9+i,played),b:seeded(table,24-i,played)}));
  const r16=Array.from({length:8},(_,i)=>({a:seeded(table,i+1,played),b:tbd('TBD')}));
  const qf=[[0,7],[3,4],[1,6],[2,5]].map(([x,y])=>({a:tbd('TBD'),b:tbd('TBD')}));
  const sf=[[0,1],[2,3]].map(([x,y])=>({a:tbd('TBD'),b:tbd('TBD')}));
  return <div className="kb">
    <section className="panel kb-hero"><span className="eyebrow">KNOCKOUT PHASE</span><h2>The road to the final</h2>
      <p>Places 1–8 go straight into the round of 16. Places 9–24 play off for the other eight spots.{played?' The bracket follows the live league table.':' Every slot stays blank until the league table is defined.'}</p>
      <p className="kb-note">This is a projection from the league table. Pairings follow the standard seeded pattern (9 v 24, 10 v 23 …), and later rounds fill in as results become official.</p></section>
    <div className="kb-scroll"><div className="kb-cols">
      <div className="kb-col"><h3>Playoff · places 9–24</h3>{po.map((t,i)=><Tie key={i} a={t.a} b={t.b} note={`Playoff ${i+1}`}/>)}</div>
      <div className="kb-col"><h3>Round of 16</h3>{r16.map((t,i)=><Tie key={i} a={t.a} b={t.b} note={`R16 ${i+1}`}/>)}</div>
      <div className="kb-col"><h3>Quarter-finals</h3>{qf.map((t,i)=><Tie key={i} a={t.a} b={t.b} note={`QF ${i+1}`}/>)}</div>
      <div className="kb-col"><h3>Semi-finals</h3>{sf.map((t,i)=><Tie key={i} a={t.a} b={t.b} note={`SF ${i+1}`}/>)}</div>
      <div className="kb-col"><h3>Final · San Mamés, Bilbao</h3><Tie a={tbd('TBD')} b={tbd('TBD')}/></div>
    </div></div>
    <section className="panel"><h3>Eliminated after the league phase</h3><p className="muted">{played?table.slice(24).map(x=>x.name).join(', ')||'Positions 25 and below.':'Positions 25 and below, once the table is defined.'}</p></section>
  </div>;
}

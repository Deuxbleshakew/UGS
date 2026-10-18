import type {AppState} from './ui';
import {fixtureSide} from '@/lib/competition';
import {standings} from '@/lib/domain';

const Step=({n,title,children}:{n:number;title:string;children:React.ReactNode})=><li className="gh-step"><span>{n}</span><div><h3>{title}</h3><p>{children}</p></div></li>;

export function RulesGuide({state}:{state:AppState|null}){
  const c=state?.tournament?.config,home=c?.leaguePhase?.homePerPot??0,away=c?.leaguePhase?.awayPerPot??0,perClub=(home+away)*3;
  return <div className="gh">
    <section className="panel gh-hero"><span className="eyebrow">RULES & GUIDE</span><h2>How the competition works</h2><p>Everything a manager needs, from the draw to the final result. Ask an organizer if something is unclear.</p></section>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">FORMAT</span><h2>The league phase</h2></div></div>
      <ul className="gh-list">
        <li>The final <b>36 clubs</b> will be divided into <b>3 pots of 12</b> after qualification and the players’ team-strength vote. Pot assignments are still pending. Managers are paired with clubs in the draw and stay hidden until it happens.</li>
        {perClub>0&&<li>Each club plays <b>{perClub} league matches</b>: {home} at home and {away} away against each pot.</li>}
        <li>A win is 3 points, a draw 1, a loss 0. The table orders by points, then goal difference, then goals scored.</li>
        <li>Positions <b>1–8 qualify directly</b>; positions <b>9–24 play off</b> for the remaining places. The table colours show each zone.</li>
        <li>The <b>Last 5</b> column shows each club’s most recent official results, oldest on the left. Hover a circle to see the score and opponent.</li>
      </ul></section>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">MATCH DAY</span><h2>Playing and reporting a match</h2></div></div>
      <ol className="gh-steps">
        <Step n={1} title="Agree a time">Use Fixtures & results to propose a time. Your opponent accepts or suggests another. Times show in your own time zone.</Step>
        <Step n={2} title="Play the match">Play it in EA FC and keep the final-score screen. Any extra statistics screenshots help the organizers.</Step>
        <Step n={3} title="Submit the result">One manager submits the score and statistics with a <b>final-score screenshot</b>. A final-score proof is required.</Step>
        <Step n={4} title="Opponent confirms">The other manager confirms, or disputes it with a reason. Disputes go to the organizers.</Step>
        <Step n={5} title="Organizer approves">An organizer reviews the evidence and makes the result official. Only official results count in the table, statistics and awards.</Step>
      </ol></section>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">QUALIFICATION</span><h2>Player playoffs and Elo</h2></div></div>
      <ul className="gh-list">
        <li>Elo ratings are only for real, registered players. Every official player result moves the ratings.</li>
        <li>League results are weighted by club stars: beating a higher-rated club is worth more Elo, beating a lower-rated one less, and losing with the better club costs more. Clubs without stars count as equal.</li>
        <li>The player qualification playoff switches on automatically once <b>more than 13 players</b> have joined.</li>
        <li>The top five by Elo qualify directly. Everyone else is seeded and plays two legs, home and away. Rounds are drawn automatically as soon as every tie is settled.</li>
      </ul></section>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">TEAMS & SQUADS</span><h2>Team vote and squad builder</h2></div></div>
      <ul className="gh-list">
        <li>The community team vote decides who qualifies: the top teams go straight through and the rest play home-and-away ties in EA FC, with the organizer entering the scores.</li>
        <li>The squad builder opens after the draw (or earlier if an organizer opens it). Build up to five tactics, then copy the EA FC tactic code or share your squad code.</li>
        <li>Tactic codes are generated from the same rules as the in-game tactics screen. Paste them in-game to confirm they load as expected.</li>
      </ul></section>
  </div>;
}

export function HistoryView({state}:{state:AppState|null}){
  const t=state?.tournament,c=t?.config,fs=(state?.fixtures??[]).filter(f=>f.status==='finalized'&&f.report);
  if(!t||!c)return <section className="panel ugs-planned-page"><h2>Pick a tournament</h2><p>Select a tournament to see its history.</p></section>;
  const sorted=[...fs].sort((a,b)=>String(b.finalized_at).localeCompare(String(a.finalized_at)));
  const byDay=new Map<string,typeof sorted>();
  for(const f of sorted){const d=String(f.finalized_at).slice(0,10);byDay.set(d,[...(byDay.get(d)??[]),f]);}
  const done=(state?.playoffs??[]).filter(p=>p.status==='complete');
  const table=standings(c,state?.fixtures??[],'all').filter(x=>x.played).slice(0,3);
  const goals=fs.reduce((n,f)=>n+(f.report?.homeScore??0)+(f.report?.awayScore??0),0);
  return <div className="gh">
    <section className="panel gh-hero"><span className="eyebrow">HISTORY</span><h2>{t.name}</h2><p>A running record of official results{t.locked_at?' and the honours of this season':''}.</p>
      <div className="gh-stats"><div><b>{fs.length}</b><span>Official results</span></div><div><b>{goals}</b><span>Goals</span></div><div><b>{done.length}</b><span>Playoffs completed</span></div></div></section>
    {t.locked_at&&table.length>0&&<section className="panel"><div className="section-heading"><div><span className="eyebrow">SEASON RECAP</span><h2>Table leaders</h2></div></div><ol className="gh-list">{table.map(x=><li key={x.id}><b>{x.name}</b> · {x.points} pts · GD {x.gd>0?'+':''}{x.gd}</li>)}</ol></section>}
    {done.map(p=><section className="panel" key={p.id}><div className="section-heading"><div><span className="eyebrow">QUALIFICATION</span><h2>{p.name}</h2></div></div><p className="muted">Qualified: {p.qualified.map(pid=>p.entrants.find(e=>e.id===pid)?.name??pid).join(', ')}</p></section>)}
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">RESULTS</span><h2>Official results, newest first</h2></div></div>
      {!sorted.length&&<p className="muted">No official results yet. They will appear here as organizers approve them.</p>}
      {[...byDay.entries()].map(([day,list])=><div className="gh-day" key={day}><h3>{new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h3>
        {list.map(f=>{const h=fixtureSide(f,'home',c,state?.players),a=fixtureSide(f,'away',c,state?.players);return <div className="gh-result" key={f.id}><span>{h.name}</span><b>{f.report!.homeScore}–{f.report!.awayScore}</b><span>{a.name}</span></div>;})}
      </div>)}
    </section>
  </div>;
}

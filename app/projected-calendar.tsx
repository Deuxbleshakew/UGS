import type {Config} from '@/lib/domain';

const day=(d:Date)=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
/** Before the draw there are no real fixtures. This shows the empty calendar (no clubs, no managers) with each matchweek's dates spread evenly across the season. */
export function ProjectedCalendar({config,season}:{config:Config;season?:{start:string|null;end:string|null}}){
  // UCL league phase: 36 teams, 8 matchweeks, 18 matches a week. The saved config can be a test setup with one pot, so it does not decide the size of the preview.
  const weeks=8,perWeek=18;
  const start=season?.start?new Date(season.start):null,end=season?.end?new Date(season.end):null,span=start&&end?end.getTime()-start.getTime():0;
  const range=(w:number)=>{if(!start||!end||span<=0)return null;const a=new Date(start.getTime()+span*(w-1)/weeks),b=new Date(start.getTime()+span*w/weeks-1);return `${day(a)} – ${day(b)}`;};
  return <div className="mw-groups pc">
    <p className="fine-print">The draw has not been imported yet, so clubs and managers are not assigned. This is the calendar that will fill in.{!start&&' Set the season start and end in Tournament setup to see dates.'}</p>
    {Array.from({length:weeks},(_,i)=>i+1).map(w=><section className="mw-group" key={w}>
      <header><h3>Matchweek {w}</h3><span>{range(w)??'Dates not set'}</span></header>
      <div className="pc-rows">{Array.from({length:perWeek},(_,m)=><div className="pc-row" key={m}><span className="pc-team">TBD</span><span className="pc-vs">vs</span><span className="pc-team">TBD</span></div>)}</div>
    </section>)}
  </div>;
}

import {ArrowRight} from 'lucide-react';
import type {Fixture} from '@/lib/domain';
import type {AppState} from './ui';
import {viewHref, type UgsView} from './ugs-navigation';

type Step={title:string;text:string;view:UgsView;cta:string};

/** What should this person do next? Built only from data the app really tracks; says nothing when there is nothing to do. */
export function nextStep(state:AppState|null):Step|null{
  const t=state?.tournament,m=state?.member;
  if(!t||!m)return null;
  const c=t.config,fs=state?.fixtures??[],drawn=c.clubs.some(x=>x.manager);
  const side=(f:Fixture,s:'home'|'away')=>f.kind==='player'?(state?.players?.find(p=>p.id===f[s])?.name??'Player'):(c.clubs.find(x=>x.id===f[s])?.name??f[s]);
  if(m.role==='admin'){
    const ready=fs.filter(f=>f.status==='confirmed').length,disputed=fs.filter(f=>f.status==='disputed').length,waitingFix=fs.filter(f=>f.status==='correction').length;
    if(ready||disputed)return {title:'Results need you',text:`${ready?`${ready} result${ready===1?' is':'s are'} confirmed by the opponent and ready for you to finalize. `:''}${disputed?`${disputed} disputed result${disputed===1?' needs':'s need'} your decision. `:''}${waitingFix?`${waitingFix} more ${waitingFix===1?'is':'are'} waiting on a manager to correct and resubmit.`:''}`.trim(),view:'review',cta:'Open review queue'};
    if(waitingFix)return {title:'Waiting on managers',text:`${waitingFix} result${waitingFix===1?' is':'s are'} waiting on a manager to correct and resubmit. Nothing needs you right now.`,view:'review',cta:'See waiting results'};
    if(!drawn)return {title:'The draw is not published yet',text:'Managers see generic names and no club assignments until you import the draw in Tournament setup.',view:'settings',cta:'Open setup'};
    if(!state?.season?.start||!state?.season?.end)return {title:'Season dates are not set',text:'Fixture dates are spread across the season dates, so set them in Tournament setup.',view:'settings',cta:'Open setup'};
    return {title:'Nothing is waiting for review',text:'No results are confirmed or disputed right now.',view:'fixtures',cta:'See fixtures'};
  }
  if(m.role==='manager'){
    if(!drawn)return {title:'The draw has not been published yet',text:'Your clubs and opponents will appear here once it is.',view:'overview',cta:'See the competition'};
    const mine=fs.filter(f=>f.kind==='player'?!!m.player_id&&[f.home,f.away].includes(m.player_id):c.clubs.some(x=>x.manager===m.manager_id&&[f.home,f.away].includes(x.id)));
    const open=mine.filter(f=>f.status!=='finalized').sort((a,b)=>a.matchday-b.matchday)[0];
    if(!open)return mine.length?{title:'All your matches are official',text:'Nothing left to report right now. Check the table to see where you stand.',view:'standings',cta:'Open the table'}:{title:'No fixtures for you yet',text:'Your matches will show up here when they are scheduled.',view:'fixtures',cta:'See all fixtures'};
    const who=`${side(open,'home')} vs ${side(open,'away')} · Matchweek ${open.matchday}`;
    
    const hint:Record<string,string>={
      scheduled:'Play it in EA FC, then submit the result with a final-score screenshot.',
      pending:'A result has been submitted. The opponent needs to confirm or dispute it. Open the match to see if it is waiting on you.',
      confirmed:'The opponent confirmed the score. It is not official until an admin finalizes it.',
      disputed:'This result is disputed. An organizer will look at it.',
      correction:'An admin asked for a correction. Either manager in this match can update the report and resubmit it.',
    };
    return {title:'Your next match',text:`${who}. ${hint[open.status]??''}`.trim(),view:'fixtures',cta:'Open fixtures'};
  }
  return {title:'You are following UCL',text:'Follow the table, the fixtures and the bracket as results become official.',view:'standings',cta:'Open the table'};
}

export default function NextAction({state}:{state:AppState|null}){
  const s=nextStep(state);
  if(!s)return null;
  return <section className="next-action" aria-label="Your next step"><div><span className="eyebrow">YOUR NEXT STEP</span><h3>{s.title}</h3><p>{s.text}</p></div><a className="btn primary" href={viewHref(s.view)}>{s.cta} <ArrowRight size={16} aria-hidden="true"/></a></section>;
}

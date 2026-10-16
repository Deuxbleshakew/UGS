import Image from 'next/image';
import {ArrowRight, CalendarDays, Gamepad2, Globe2, Shield, Trophy, Users} from 'lucide-react';
import type {AppState} from './ui';
import {RulesGuide, HistoryView} from './guide-history';
import TiquiciaRoster from './tiquicia-roster';
import NextAction from './next-action';
import {ugsViews, viewHref, type UgsView} from './ugs-navigation';

type Props = {view: UgsView; state: AppState | null; onNavigate: (view: string) => void; onDialog: (type: string) => void};

function Destination({view, title, description}: {view: UgsView; title: string; description: string}) {
  return <a className="ugs-destination" href={viewHref(view)}>
    <div><h3>{title}</h3><p>{description}</p></div><ArrowRight size={21} aria-hidden="true" />
  </a>;
}

const plannedCopy: Partial<Record<UgsView, {title: string; description: string}>> = {
  profile: {title: 'Your place in Union Gaming.', description: 'Profile editing, gaming IDs and favorite teams are planned. Your current account and sign-in remain available as before.'},
};

export default function UgsSections({view, state, onNavigate, onDialog}: Props) {
  if (view === 'guide') return <RulesGuide state={state} />;
  if (view === 'history') return state?.member?.role === 'admin' ? <HistoryView state={state} /> : <section className="panel ugs-planned-page"><h2>History is for organizers</h2><p>This page is only available to the admin account.</p><a className="btn primary" href={viewHref('matchroom')}>Back to UCL <ArrowRight size={16} /></a></section>;
  const planned = plannedCopy[view];
  if (planned) return <section className="panel ugs-planned-page">
    <span className="ugs-planned-label">Planned · not available yet</span>
    <h2>{planned.title}</h2><p>{planned.description}</p>
    <a className="btn primary" href={viewHref(view === 'profile' ? 'home' : 'matchroom')}>Back to {view === 'profile' ? 'UGS Home' : 'UCL'} <ArrowRight size={16} /></a>
  </section>;

  if (view === 'home') return <>
    <section className="ugs-hero">
      <div className="ugs-hero-copy"><div className="eyebrow">UNION GAMING SOCIETY</div>
        <h1>Different players.<br /><span>One Union.</span></h1>
        <p>Union Gaming Society is our community: friends with Costa Rican roots and players from everywhere else, playing together. UCL is where we compete. RB Tiquicia is where we play as one team.</p>
        <div className="ugs-actions"><a className="btn ugs-white-button" href={viewHref('matchroom')}>Enter UCL <ArrowRight size={17} /></a><a className="ugs-hero-link" href={viewHref('tiquicia')}>Meet RB Tiquicia <ArrowRight size={16} /></a></div>
      </div>
      <div className="ugs-hero-art" aria-hidden="true"><div className="ugs-flag-lines" /><Image src="/brand/ugs-orchid.png" alt="" width={1254} height={1254} unoptimized priority /><span>UNION GAMING</span></div>
    </section>
    <div className="spot-banner spot-duo" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/spotlight-duo.jpg" alt="" className="" loading="lazy"/><span>Two players. One league.</span></div>
    <NextAction state={state} />
    <div className="ugs-section-heading"><div><span className="eyebrow">YOUR COMMUNITY</span><h2>Find your next game.</h2></div><Globe2 size={22} aria-hidden="true" /></div>
    <div className="ugs-feature-grid">
      <article className="panel ugs-feature-card"><span className="ugs-feature-icon"><Trophy size={25} /></span><span className="eyebrow">COMPETE</span><h2>UCL</h2><p>One community. No easy matches. Follow Club Champions, find your fixtures and see how our players rank.</p><a className="text-btn" href={viewHref('matchroom')}>Open UCL <ArrowRight size={17} /></a></article>
      <article className="panel ugs-feature-card ugs-team-card"><Image src="/brand/rb-tiquicia.png" alt="RB Tiquicia crest" width={640} height={641} unoptimized className="ugs-team-card-crest" /><span className="eyebrow">PLAY TOGETHER</span><h2>RB Tiquicia</h2><p>Raíces ticas. Un solo equipo. Our community’s Pro Clubs team.</p><a className="text-btn" href={viewHref('tiquicia')}>Visit the team <ArrowRight size={17} /></a></article>
    </div>
    <div className="ugs-community-note"><Gamepad2 size={22} aria-hidden="true" /><p><b>The match ends. The community stays.</b> UGS brings us together, UCL is where we compete, and room is left for more games.</p></div>
  </>;

  if (view === 'matchroom') return <>
    <section className="ugs-competition-banner"><div><span className="eyebrow">A UGS COMPETITION</span><h2>Club Champions</h2><p>Qualification, fixtures, standings and the performances behind every result.</p><a className="btn ugs-white-button" href={viewHref('overview')}>Open competition <ArrowRight size={17} /></a></div><Trophy size={105} strokeWidth={1} aria-hidden="true" /></section>
    <div className="ugs-context-strip"><span>Selected tournament</span><strong>{state?.tournament?.name ?? 'No tournament available'}</strong>{!!state?.tournaments.length && (state.user.isOwner || state.member?.role === 'admin') && <button className="text-btn" onClick={() => onDialog('switch')}>Switch tournament <ArrowRight size={15} /></button>}</div>
    <div className="ugs-destination-grid"><Destination view="playoffs" title="Qualification" description="Follow the seeded player playoffs and direct places." /><Destination view="fixtures" title="Fixtures & results" description="Open the match workspace to schedule or report a result." /><Destination view="elo" title="Players & Elo" description="See community player rankings and recent form." /><Destination view="standings" title="League table" description="Follow finalized club results in the current tournament." /></div>
  </>;

  if (view === 'tiquicia') return <>
    <section className="ugs-team-hero"><div><span className="eyebrow">UNION GAMING · PRO CLUBS</span><h2>RB Tiquicia</h2><p>Our club.<br /><strong>Our people.</strong></p><div className="ugs-team-description">RB Tiquicia is the community’s Pro Clubs team, bringing our Costa Rican roots and international friendships onto the pitch.</div></div><div className="ugs-team-crest"><Image src="/brand/rb-tiquicia.png" alt="RB Tiquicia team crest supplied by the community" width={640} height={641} unoptimized priority /></div></section>
    <div className="ugs-team-info"><TiquiciaRoster /><section className="panel"><CalendarDays size={24} /><h2>Fixtures & results</h2><p>No RB Tiquicia fixtures or results have been published here yet.</p></section></div>
  </>;

  if (view === 'admin' && state?.user.isOwner) return <>
    <div className="ugs-context-strip"><Shield size={19} /><span>Owner workspace</span><strong>{state.tournament?.name ?? 'Create your first tournament'}</strong><button className="text-btn" onClick={() => onDialog('switch')}>Your tournaments <ArrowRight size={15} /></button></div>
    <div className="ugs-destination-grid"><Destination view="settings" title="Tournament setup & access" description="Use the existing player invitations, Unity imports and exports." /><Destination view="roster" title="Players & photos" description="Add players and upload their photos." /><Destination view="review" title="Review queue" description="Review submitted evidence, resolve disputes and finalize results." /></div>
    <section className="panel ugs-admin-actions"><h2>Tournament tools</h2><p>Choose a tournament above before managing its fixtures.</p><div className="ugs-actions"><button className="btn primary" onClick={() => onDialog('create')}>Create tournament <ArrowRight size={16} /></button><button className="btn secondary" disabled={!state.tournament || state.member?.role !== 'admin'} onClick={() => onDialog('fixture')}>Add fixture</button><button className="btn secondary" onClick={() => onNavigate('playoffs')}>Open qualification</button></div></section>
  </>;

  return null;
}

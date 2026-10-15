'use client';
import {useEffect, useRef, useState, type MouseEvent} from 'react';
import {Activity, AlertCircle, ArrowDownToLine, ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Dices, FileCheck2, Gamepad2, GitBranch, Home, LayoutDashboard, Loader2, LockKeyhole, LogOut, Menu, Plus, Settings2, Shield, ShieldCheck, Trophy, UserRound, Users, X, type LucideIcon} from 'lucide-react';
import {type Config, type Fixture} from '@/lib/domain';
import initialConfig from '@/data/draw-config.json';
import {api, Empty, Modal, type AppState} from './ui';
import Views from './views';
import MatchReport from './match-report';
import WorkspaceDialog from './workspace-dialog';
import UgsBrand from './ugs-brand';
import UgsSections from './ugs-sections';
import MyProfile from './my-profile';
import MatchweekPanel from './matchweek-panel';
import ScheduleSettings from './schedule-settings';
import Friendlies from './friendlies';
import {ParticipationQuestion} from './participation-choice';
import {adminViews, competitionViews, isUgsView, matchroomViews, ugsViews, viewFromHash, viewHref, type UgsView} from './ugs-navigation';

const icons: Record<UgsView, LucideIcon> = {
  home: Home, matchroom: Gamepad2, overview: LayoutDashboard, guide: BookOpen,
  playoffs: GitBranch, teamplayoffs: Dices, squad: Users, fixtures: CalendarDays, standings: BarChart3, clubs: Shield,
  statistics: Activity, awards: Trophy, elo: Users, friendlies: Gamepad2, history: Clock3,
  tiquicia: Shield, profile: UserRound, admin: ShieldCheck, review: FileCheck2, settings: Settings2,
};
const existingViews: readonly UgsView[] = ['overview', 'playoffs', 'teamplayoffs', 'squad', 'fixtures', 'standings', 'clubs', 'statistics', 'awards', 'elo', 'review', 'settings'];

export default function TournamentApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<UgsView>('home');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [toast, setToast] = useState(''), [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<string | null>(null), [selected, setSelected] = useState<Fixture | null>(null);
  const mainRef = useRef<HTMLElement>(null), menuRef = useRef<HTMLButtonElement>(null);
  const tournament = state?.tournament;
  const config = tournament?.config ?? initialConfig as Config;
  const fixtures = state?.fixtures ?? [];
  const admin = state?.member?.role === 'admin', owner = !!state?.user.isOwner, ready = !!tournament;
  const queue = fixtures.filter(f => ['pending', 'confirmed', 'disputed'].includes(f.status));
  const inMatchroom = matchroomViews.includes(view), inAdmin = adminViews.includes(view);
  const definition = ugsViews[view], existing = existingViews.includes(view);
  const competition = competitionViews.includes(view);
  const denied = inAdmin && (!owner || (view !== 'admin' && ready && !admin));

  async function refresh(tid?: string) {
    const next = await api<AppState>('state' + (tid ? '?tournament=' + encodeURIComponent(tid) : ''));
    setState(next);
    return next;
  }
  useEffect(() => {refresh().catch(e => setError(e.message)).finally(() => setLoading(false));}, []);
  useEffect(() => {
    setView(viewFromHash(window.location.hash));
    const change = () => {
      setView(viewFromHash(window.location.hash));
      setMobile(false);
      mainRef.current?.focus({preventScroll: true});
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!mobile) return;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {setMobile(false); menuRef.current?.focus();}
    };
    document.addEventListener('keydown', closeMenu);
    return () => document.removeEventListener('keydown', closeMenu);
  }, [mobile]);

  function navigate(next: string) {
    if (!isUgsView(next)) return;
    setView(next);
    setMobile(false);
    if (window.location.hash !== viewHref(next)) window.location.hash = viewHref(next);
    else mainRef.current?.focus({preventScroll: true});
  }
  function follow(event: MouseEvent<HTMLAnchorElement>, next: UgsView) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(next);
  }
  function open(type: string) {
    if (type === 'switch') {setModal('switch'); return;}
    if (!owner || (ready && !admin)) {setToast('Only the organizer can change tournament setup.'); return;}
    setModal(ready ? type : 'create');
  }
  function openMatch(f: Fixture) {
    if(f.kind==='club'&&f.stage==='league'&&state?.matchweeks?.enabled&&f.matchday>(state.matchweeks.currentWeek??0)&&!admin){setToast('This future matchweek is locked. Kickoff bookings are tentative until the owner opens it.');return;}
    const canSee = admin || f.status === 'finalized' || (state?.member?.role === 'manager' && (f.kind === 'player'
      ? !!state?.member?.player_id && [f.home, f.away].includes(state.member.player_id)
      : config.clubs.some(c => [f.home, f.away].includes(c.id) && c.manager === state?.member?.manager_id)));
    if (!canSee) {setToast('This report is private to its participants until finalized.'); return;}
    setSelected(f); setModal('match');
  }
  const close = () => setModal(null);
  async function saved(tid?: string) {
    await refresh(tid ?? tournament?.id);
    setModal(null); setToast('Saved to your tournament workspace.');
  }
  function download(kind: string) {
    if (tournament) window.location.href = `/api/tournament/${tournament.id}/export?kind=${encodeURIComponent(view === 'elo' && kind === 'matches' ? 'elo' : kind)}`;
  }
  function navLink(id: UgsView, sectionActive = false) {
    const item = ugsViews[id], Icon = icons[id];
    return <a key={id} href={viewHref(id)} onClick={e => follow(e, id)} className={`ugs-nav-link ${view === id ? 'active' : sectionActive ? 'section-active' : ''}`} aria-current={view === id ? 'page' : undefined}>
      <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
      {item.planned && <small className="ugs-nav-planned">Planned</small>}
      {id === 'review' && queue.length > 0 && <em aria-label={`${queue.length} reports`}>{queue.length}</em>}
    </a>;
  }

  if(state?.onboardingRequired&&state.profile?.askInterest)return <main className="ugs-onboarding"><UgsBrand/><ParticipationQuestion onDone={()=>refresh()}/><button className="btn secondary" onClick={async()=>{try{await api('auth/logout',{});window.location.assign('/login');}catch(e){setError((e as Error).message);}}}>Sign out</button></main>;
  if(state?.onboardingRequired&&state.profile)return <main className="ugs-onboarding"><UgsBrand/><p className="notice">Complete your profile to enter Union Gaming. Your account and history are preserved.</p><MyProfile key={state.profile.version} profile={state.profile} username={state.user.username} userId={state.user.userId} onRefresh={()=>refresh()}/><button className="btn secondary" onClick={async()=>{try{await api('auth/logout',{});window.location.assign('/login');}catch(e){setError((e as Error).message);}}}>Sign out</button>{error&&<p role="alert">{error}</p>}</main>;
  return <div className="app-shell ugs-app">
    <a className="ugs-skip-link" href="#ugs-main" onClick={event => {event.preventDefault(); mainRef.current?.focus();}}>Skip to content</a>
    <aside id="ugs-sidebar" className={`sidebar ${mobile ? 'is-open' : ''}`}>
      <a className="ugs-brand-link" href={viewHref('home')} onClick={e => follow(e, 'home')} aria-label="Union Gaming Society home"><UgsBrand /></a>
      <nav aria-label="Main navigation">
        {navLink('home')}
        {navLink('matchroom', inMatchroom)}
        {inMatchroom && <div className="ugs-subnav">
          <p className="ugs-nav-heading">Club Champions</p>
          {competitionViews.map(id => navLink(id))}
          <div className="ugs-nav-divider" />
          {(['elo', 'friendlies', 'history'] as const).map(id => navLink(id))}
        </div>}
        {navLink('tiquicia')}
        {navLink('profile')}
        {owner && navLink('admin', inAdmin)}
        {owner && inAdmin && <div className="ugs-subnav">{navLink('review')}{navLink('settings')}</div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="account"><span className="avatar">{state?.user.displayName.slice(0, 1).toUpperCase() ?? 'U'}</span><div><b>{state?.user.displayName ?? 'Union Gaming'}</b><small>{owner ? 'Owner · Admin' : 'Member account'}</small></div><button className="icon-btn" aria-label="Sign out" onClick={async () => {try {await api('auth/logout', {}); window.location.assign('/login');} catch (e) {setError((e as Error).message);}}}><LogOut size={17} /></button></div>
      </div>
    </aside>
    {mobile && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => {setMobile(false); menuRef.current?.focus();}} />}
    <div className="main-shell">
      <header className="topbar">
        <button ref={menuRef} className="icon-btn mobile-menu" aria-label={mobile ? 'Close navigation' : 'Open navigation'} aria-controls="ugs-sidebar" aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu /></button>
        <div className="breadcrumb"><a href={viewHref('home')} onClick={e => follow(e, 'home')}>UGS</a><ChevronRight size={14} />{(competition || view === 'elo' || view === 'friendlies' || view === 'history') && <><a href={viewHref('matchroom')} onClick={e => follow(e, 'matchroom')}>Matchroom</a><ChevronRight size={14} /></>}{competition && <span className="ugs-competition-crumb">Club Champions <ChevronRight size={14} /></span>}<strong>{definition.label}</strong></div>
        <div className="topbar-right"><span className="private-label"><LockKeyhole size={13} />Members only</span><span className="avatar small">{state?.user.displayName.slice(0, 1).toUpperCase() ?? 'U'}</span></div>
      </header>
      <main id="ugs-main" ref={mainRef} tabIndex={-1} className="ugs-main">
        {loading && <div className="notice" role="status"><Loader2 className="spin" size={18} />Opening Union Gaming…</div>}
        {error && <div className="notice error" role="alert"><AlertCircle size={18} /><span>{error}</span>{error.includes('Sign in') ? <a href="/login">Sign in</a> : <button onClick={() => {setError(''); setLoading(true); refresh(tournament?.id).catch(e => setError(e.message)).finally(() => setLoading(false));}}>Retry</button>}<button className="icon-btn" onClick={() => setError('')} aria-label="Dismiss error"><X size={17} /></button></div>}
        {!loading && state && <>
          {view === 'home' && (state.profile?.participation === 'no' || state.profile?.participation === 'pending') && <p className="notice viewer-note" role="status">You are following as a viewer. More for followers is coming soon. Want to play? Ask to take part in My Profile.</p>}
          {view !== 'home' && <div className="page-heading"><div><div className="eyebrow">{competition ? 'MATCHROOM / CLUB CHAMPIONS' : inAdmin ? 'UGS / OWNER WORKSPACE' : 'UNION GAMING SOCIETY'}</div><h1>{view === 'overview' ? 'Club Champions' : definition.label}</h1><p>{definition.description}</p></div>{existing && !denied && <div className="heading-actions">{ready && <button className="btn secondary" onClick={() => download(view === 'awards' ? 'awards' : view === 'standings' ? 'clubs' : 'matches')}><ArrowDownToLine size={16} />Export CSV</button>}{(admin || (!ready && owner)) && <button className="btn primary" onClick={() => open('fixture')}><Plus size={17} />{ready ? 'Add fixture' : 'Create tournament'}</button>}</div>}</div>}
          {existing && !denied && <div className="ugs-workspace-strip"><div><span className="eyebrow">SELECTED TOURNAMENT</span><strong>{tournament?.name ?? 'No tournament selected'}</strong></div><button className="btn secondary" onClick={() => open('switch')}><Shield size={16} />Your tournaments <ChevronDown size={15} /></button></div>}
          {(view==='fixtures'||view==='overview')&&<MatchweekPanel key={tournament?.id} state={state} onRefresh={()=>refresh(tournament?.id)}/>}
          {owner&&view==='settings'&&tournament&&<ScheduleSettings key={tournament.id} tid={tournament.id} weeks={(state?.matchweeks?.weeks??[]).map(w=>w.week)} timezone={state?.profile?.data.timezone}/>}
          {view==='profile'&&state.profile ? <MyProfile key={state.profile.version} profile={state.profile} username={state.user.username} userId={state.user.userId} onRefresh={()=>refresh(tournament?.id)}/> : view==='friendlies'&&state.profile ? <Friendlies timezone={state.profile.data.timezone}/> : denied ? <Empty title="Owner access required" description="Only the owner can open tournament administration. Choose an authorized tournament to manage it." />
            : existing && !ready && view !== 'settings' ? <Empty title="No tournament available yet" description={owner ? 'Create a tournament to start using the competition workspace.' : 'Your organizer will authorize your tournament access.'}>{owner && <button className="btn primary" onClick={() => open('create')}>Create tournament <ArrowRight size={16} /></button>}</Empty>
            : existing ? <Views view={view} state={state} config={config} fixtures={fixtures} onNavigate={navigate} onOpenMatch={openMatch} onDialog={open} onExport={download} onRefresh={() => refresh(tournament?.id)} />
            : <UgsSections view={view} state={state} onNavigate={navigate} onDialog={open} />}
        </>}
        <footer className="app-footer"><span><strong>UNION GAMING</strong></span><span>UGS · Union Gaming Society</span></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button className="icon-btn" aria-label="Dismiss message" onClick={() => setToast('')}><X size={16} /></button></div>}
    {modal === 'switch' && <Modal title="Your tournaments" subtitle="Choose the workspace you want to open." onClose={close}><div className="modal-body">{state?.tournaments.length ? state.tournaments.map(t => <button className="switch-row" key={t.id} onClick={() => saved(t.id).catch(e => setError(e.message))}><Shield size={21} />{t.name}<ChevronRight size={18} /></button>) : <p className="muted">{owner ? 'No tournaments created yet.' : 'No tournaments have been assigned to your account yet.'}</p>}{owner && <button className="btn secondary full" onClick={() => setModal('create')}><Plus size={17} />New tournament</button>}</div></Modal>}
    {modal === 'match' && selected && tournament && state?.member && <MatchReport fixture={selected} config={config} players={state.players} fixtures={fixtures} tournamentId={tournament.id} user={state.user} member={state.member} timezone={state.profile?.data.timezone} onClose={close} onSaved={() => saved()} />}
    {owner && modal && ['create', 'fixture', 'import', 'awards-lock'].includes(modal) && <WorkspaceDialog type={modal} config={config} tournament={tournament ?? null} onClose={close} onSaved={saved} />}
  </div>;
}

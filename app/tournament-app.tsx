"use client";
import {useState,useEffect} from "react";
import {Activity,ArrowDownToLine,ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,ChevronDown,ChevronRight,FileCheck2,LayoutDashboard,Loader2,LockKeyhole,Menu,Plus,Settings2,Shield,ShieldCheck,Sparkles,Trophy,Users,X,AlertCircle,LogOut,BarChart3} from "lucide-react";
import {type Config,type Fixture} from "@/lib/domain";
import initialConfig from "@/data/draw-config.json";
import {api,Modal,type AppState} from "./ui";
import Views from "./views";
import MatchReport from "./match-report";
import WorkspaceDialog from "./workspace-dialog";

const nav=[{id:"overview",label:"Overview",icon:LayoutDashboard},{id:"fixtures",label:"Fixtures & results",icon:CalendarDays},{id:"standings",label:"League table",icon:BarChart3},{id:"clubs",label:"Clubs & managers",icon:Users},{id:"statistics",label:"Statistics",icon:Activity},{id:"awards",label:"Awards",icon:Trophy},{id:"review",label:"Review queue",icon:FileCheck2},{id:"settings",label:"Tournament setup",icon:Settings2}];
const subtitles:Record<string,string>={overview:"Every club. Every result. Your season in one place.",fixtures:"From the first whistle to the final, keep every match on track.",standings:"The league, as it stands. Only finalized results count.",clubs:"The clubs on the pitch. The managers behind them.",statistics:"The numbers behind your tournament, backed by verified results.",awards:"Great performances deserve their moment.",review:"Turn submitted match reports into official results.",settings:"Set up your season and connect your Unity draw."};

export default function TournamentApp(){
  const [state,setState]=useState<AppState|null>(null),[view,setView]=useState('overview'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false);
  const [modal,setModal]=useState<string|null>(null),[selected,setSelected]=useState<Fixture|null>(null);
  const tournament=state?.tournament,config=tournament?.config??initialConfig as Config,fixtures=state?.fixtures??[],admin=state?.member?.role==='admin',ready=!!tournament;
  const queue=fixtures.filter(f=>['pending','confirmed','disputed'].includes(f.status));
  async function refresh(tid?:string){const next=await api<AppState>('state'+(tid?'?tournament='+encodeURIComponent(tid):''));setState(next);return next;}
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timeout);},[toast]);
  function navigate(next:string){setView(next);setMobile(false);}
  function open(type:string){if(ready&&!admin){setToast('Only the organizer can change tournament setup.');return;}setModal(ready?type:'create');}
  function openMatch(f:Fixture){
    const canSee=admin||f.status==='finalized'||config.clubs.some(c=>[f.home,f.away].includes(c.id)&&c.manager===state?.member?.manager_id);
    if(!canSee){setToast('This report is private to its participants until finalized.');return;}
    setSelected(f);setModal('match');
  }
  const close=()=>setModal(null);
  async function saved(tid?:string){await refresh(tid??tournament?.id);setModal(null);setToast('Saved to your tournament workspace.');}
  function download(kind:string){if(tournament)window.location.href=`/api/tournament/${tournament.id}/export?kind=${kind}`;}
  return <div className="app-shell">
    <aside className={`sidebar ${mobile?'is-open':''}`}>
      <a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('overview');}}><span className="brand-icon"><Trophy size={23}/></span>matchroom<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR TOURNAMENT</div><button className="workspace" onClick={()=>setModal('switch')}><span className="season-icon"><Shield size={20}/></span><span><b>{tournament?.name??'UCL Fantasy'}</b><small>{ready?'Tournament workspace':'2026 / 27 season'}</small></span><ChevronDown size={16}/></button>
      <nav>{nav.map(item=>{const Icon=item.icon;if(item.id==='review'&&!admin&&ready)return null;return <button key={item.id} className={view===item.id?'active':''} onClick={()=>navigate(item.id)}><Icon size={19}/>{item.label}{item.id==='review'&&queue.length>0&&<em>{queue.length}</em>}</button>;})}</nav>
      <div className="sidebar-bottom"><div className="ceremony-link"><span><Sparkles size={18}/>From the stage to the table.</span><p>Your Unity draw. Connected to every match that follows.</p><button onClick={()=>open('import')}>Import your draw <ArrowUpRight size={16}/></button></div><div className="account"><span className="avatar">{state?.user?.displayName?.slice(0,1).toUpperCase()??'M'}</span><div><b>{state?.user?.displayName??'Your workspace'}</b><small>{admin?'Tournament organizer':'Manager workspace'}</small></div><button className="icon-btn" aria-label="Sign out" onClick={async()=>{try{await api("auth/logout",{});window.location.assign("/login");}catch(e){setError((e as Error).message);}}}><LogOut size={17}/></button></div></div>
    </aside>
    {mobile&&<button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <div className="main-shell"><header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobile(!mobile)} aria-label="Open navigation"><Menu/></button><div className="breadcrumb">Tournament HQ <ChevronRight size={14}/><strong>{nav.find(n=>n.id===view)?.label}</strong></div><div className="topbar-right"><span className="private-label"><LockKeyhole size={13}/>Members only</span><span className="avatar small">{state?.user?.displayName?.slice(0,1).toUpperCase()??'M'}</span></div></header>
    <main>
      {loading&&<div className="notice"><Loader2 className="spin" size={18}/>Opening your tournament workspace…</div>}
      {error&&<div className="notice error" role="alert"><AlertCircle size={18}/><span>{error}</span>{error.includes('Sign in')?<a href="/login" target="_top">Sign in</a>:<button onClick={()=>{setError('');refresh(tournament?.id).catch(e=>setError(e.message));}}>Retry</button>}<button className="icon-btn" onClick={()=>setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
      {!ready&&!loading&&<div className="welcome-strip"><span><Sparkles size={18}/><b>Make it your season.</b> Your Unity club list is ready.</span><button onClick={()=>setModal('create')}>Create tournament <ArrowRight size={16}/></button></div>}
      <div className="page-heading"><div><div className="eyebrow">{view==='overview'?'SEASON CONTROL CENTER':tournament?.name??'UCL FANTASY 2026 / 27'}</div><h1>{view==='overview'?'Tournament overview':nav.find(n=>n.id===view)?.label}</h1><p>{subtitles[view]}</p></div><div className="heading-actions">{ready&&<button className="btn secondary" onClick={()=>download(view==='awards'?'awards':view==='standings'?'clubs':'matches')}><ArrowDownToLine size={16}/>Export CSV</button>}{(admin||!ready)&&<button className="btn primary" onClick={()=>open('fixture')}><Plus size={17}/>Add fixture</button>}</div></div>
      <Views view={view} state={state} config={config} fixtures={fixtures} onNavigate={navigate} onOpenMatch={openMatch} onDialog={open} onExport={download} onRefresh={()=>refresh(tournament?.id)}/>
      <footer className="app-footer"><span>matchroom. <b>Built for the way you compete.</b></span><span><ShieldCheck size={13}/>Verified results. Fair competition.</span></footer>
    </main></div>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button className="icon-btn" aria-label="Dismiss message" onClick={()=>setToast('')}><X size={16}/></button></div>}
    {modal==='switch'&&<Modal title="Your tournaments" onClose={close}><div className="modal-body">{state?.tournaments.map(t=><button className="switch-row" key={t.id} onClick={()=>saved(t.id).catch(e=>setError(e.message))}><Shield size={21}/>{t.name}<ChevronRight size={18}/></button>)}{state?.user.isOwner&&<button className="btn secondary full" onClick={()=>setModal('create')}><Plus size={17}/>New tournament</button>}</div></Modal>}
    {modal==='match'&&selected&&tournament&&state?.member&&<MatchReport fixture={selected} config={config} tournamentId={tournament.id} user={state.user} member={state.member} onClose={close} onSaved={()=>saved()}/>}
    {modal&&['create','fixture','import','awards-lock'].includes(modal)&&<WorkspaceDialog type={modal} config={config} tournament={tournament??null} onClose={close} onSaved={saved}/>}
  </div>;
}

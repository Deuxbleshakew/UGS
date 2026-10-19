import { store, proofStore } from "./storage";
import {database} from '@/scripts/local-store.mjs';
import {getSettings as getScheduleSettings} from './scheduling-server';
import { getCurrentUser, sameOrigin, changePassword, type CurrentUser } from "./auth";
import seed from "@/data/draw-config.json";
import { configSchema, reportSchema, validateMatchReport, warnings, standings, managerRows, playerRows, awards, csv, type Config, type Fixture } from "./domain";
import { z } from "zod";
import { ensurePlayers, listPlayers, communityRankings, listPlayoffs, managerPlayer, addPlayer, updatePlayer, deletePlayer, createPlayoff, advancePlayoff, autoAdvancePlayoffs, cancelPlayoff, getClubStars, setClubStars, CompetitionError } from './competition-server';
import {accountDirectory, addAccountToTournament, assignUsername, authorizePlayer, authorizeViewer, createPlayerUser, AccountAccessError} from './account-access';
import {AccountRecoveryError,issuePasswordReset,renameAccountUsername} from './account-recovery';
import {getJoinLink, saveJoinLink} from './join-link';
import { checkPlayoffReport, fixtureSide } from './competition';
import {tournamentRole} from './access-policy';
import {getProfile,saveProfile} from './profile-server';
import {memberCountries} from './countries-server';
import {getMatchweeks,changeMatchweeks,requireOpenMatchweek} from './matchweeks-server';
import {getSchedule,scheduleAction,scheduleAdmin} from './scheduling-server';
import {getFriendlies,friendlyAction} from './friendlies-server';
import {maskUndrawnManagers} from './draw-privacy';
import {photoVersions,getPlayerPhoto,setPlayerPhoto} from './player-photos';
import {getAvatar,avatarInfo,saveAvatar,removeAvatar,AVATAR_UPLOAD_LIMIT} from './avatar-server';
import {disableAccount,enableAccount,removeMember} from './user-management';
import {listSquads,saveSquad,deleteSquad,setSquadsOpen} from './squads';
import {listTiquicia,changeTiquicia} from './tiquicia';
import {createTeamPlayoff,recordTeamTie,simulateTeamPlayoff,cancelTeamPlayoff,getTeamPlayoff} from './team-playoffs';
import {answerParticipation,decideParticipation,isViewerByChoice} from './participation';
import {deleteTournament,TournamentDeletionError} from './tournament-deletion';

type Member={id:string;tournament_id:string;user_id:string|null;email:string;username:string|null;name:string;role:string;manager_id:string|null;player_id:string|null};
type Tournament={id:string;name:string;owner_id:string;config:string;created_at:string;awards:string|null;locked_at:string|null;revision:number};
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
function fail(message:string,status=400):never{throw new HttpError(status,message);}
const id=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
function db(){return store;}
const query=(sql:string,...args:unknown[])=>db().prepare(sql).bind(...args);
async function all<T>(sql:string,...args:unknown[]){return (await query(sql,...args).all<T>()).results;}
function unpack(row:Record<string,unknown>):Fixture{return {...row,report:row.report?JSON.parse(String(row.report)):null} as Fixture;}
async function getFixtures(tid:string){return (await all<Record<string,unknown>>("SELECT * FROM fixtures WHERE tournament_id=? AND status<>'cancelled' ORDER BY matchday,scheduled,id",tid)).map(unpack);}
async function membership(user:CurrentUser,tid:string){
  const row=await query("SELECT m.*,t.owner_id AS tournament_owner FROM members m JOIN tournaments t ON t.id=m.tournament_id WHERE m.tournament_id=? AND m.user_id=?",tid,user.userId).first<Member&{tournament_owner:string}>();
  if(!row)fail("You do not have access to this tournament.",403);
  const {tournament_owner,...m}=row;
  // A saved membership role never grants admin authority to another account.
  const role=tournamentRole(user.isOwner,user.userId,tournament_owner,m.role);
  // Someone who chose to be a viewer (or is waiting for approval to take part) is a viewer, whatever role was saved for them.
  return {...m,role:role!=='admin'&&isViewerByChoice(user.userId)?'viewer':role};
}
const admin=(m:Member)=>{if(m.role!=="admin")fail("Only the organizer can do that.",403);};
function participant(m:Member,f:Fixture,c:Config){return m.role==="admin"||(m.role==='manager'&&(f.kind==='player'?!!m.player_id&&[f.home,f.away].includes(m.player_id):c.clubs.some(club=>[f.home,f.away].includes(club.id)&&club.manager===m.manager_id)));}
function requireParticipant(m:Member,f:Fixture,c:Config){if(!participant(m,f,c))fail("This match belongs to other managers.",403);}
function auditInsert(tid:string,user:CurrentUser,action:string,reason:string,before:unknown,after:unknown,fixture:string|null=null){
  return query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") VALUES(?,?,?,?,?,?,?,?,?,?)',id(),tid,fixture,user.userId,user.displayName,now(),action,reason,JSON.stringify(before),JSON.stringify(after));
}
async function bytes(request:Request,limit:number){
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail("File/request is too large.",413);}chunks.push(value);}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
async function body(request:Request){try{return JSON.parse(new TextDecoder().decode(await bytes(request,2*1024*1024)));}catch(e){if(e instanceof HttpError)throw e;fail("Send a valid JSON file.");}}
function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
function checkReport(report:Parameters<typeof validateMatchReport>[0],fixture:Fixture){try{validateMatchReport(report,fixture);}catch(e){fail((e as Error).message);}}

async function changeFixture(t:Tournament,m:Member,user:CurrentUser,f:Fixture,data:Record<string,unknown>){
  requireOpenMatchweek(t.id,f);
  const c=configSchema.parse(JSON.parse(t.config));requireParticipant(m,f,c);
  if(data.version!==f.version)fail("This match changed. Refresh it before saving.",409);
  const action=String(data.action??""),reason=String(data.reason??"").trim().slice(0,2000);
  let status=f.status,report=f.report,note=f.note,submittedBy=f.submitted_by,submittedManager=f.submitted_manager,submittedAt=f.submitted_at,finalizedAt=f.finalized_at;
  if(action==="submit"||action==="edit"){
    if(action==="submit"&&!['scheduled','correction'].includes(f.status))fail("This report is already under review.",409);
    if(action==="edit"){admin(m);if(!reason)fail("Explain why you are editing this report.");if(f.status==="finalized")fail("Finalized reports cannot be edited in this first version.");}
    report=reportSchema.parse(data.report);checkReport(report,f);
    if(f.tie_id){try{checkPlayoffReport(report,f,await getFixtures(t.id));}catch(e){fail((e as Error).message);}}
    const proof=await query("SELECT id FROM proofs WHERE fixture_id=? AND category='final-score' LIMIT 1",f.id).first();
    if(!proof)fail("Upload a final-score screenshot before submitting.");
    status="pending";note=action==="edit"?reason:null;submittedBy=user.userId;submittedAt=now();
    const h=f.kind==='player'?f.home:c.clubs.find(cl=>cl.id===f.home)?.manager,a=f.kind==='player'?f.away:c.clubs.find(cl=>cl.id===f.away)?.manager;
    const identity=f.kind==='player'?m.player_id:m.manager_id;
    // Only a side that really entered the report is barred from answering it. An admin who is not a side leaves this empty, so either manager may confirm or dispute.
    submittedManager=identity&&[h,a].includes(identity)?identity:null;
  }else if(action==="confirm"||action==="dispute"){
    if(f.status!=="pending")fail("This match is not awaiting opponent confirmation.",409);
    const h=f.kind==='player'?f.home:c.clubs.find(cl=>cl.id===f.home)?.manager,a=f.kind==='player'?f.away:c.clubs.find(cl=>cl.id===f.away)?.manager;
    const identity=f.kind==='player'?m.player_id:m.manager_id;
    if(user.userId===f.submitted_by||!identity||![h,a].includes(identity)||identity===f.submitted_manager)fail("Only the opposing player can confirm or dispute this report.",403);
    if(action==="dispute"&&!reason)fail("Add a reason so the organizer can resolve the dispute.");
    status=action==="confirm"?"confirmed":"disputed";note=reason||"Opponent confirmed the report.";
  }else if(action==="correction"){
    admin(m);if(!reason)fail("Explain what needs correcting.");if(!['pending','confirmed','disputed'].includes(f.status))fail("Only a submitted report can be returned for correction.");status="correction";note=reason;
  }else if(action==="finalize"){
    admin(m);if(t.locked_at)fail("Unlock the awards before finalizing more results.");
    if(!['pending','confirmed','disputed'].includes(f.status)||!report)fail("Submit a report before finalizing it.");
    if((f.status!=="confirmed"||warnings(report,f).length)&&!reason)fail("Explain the override when the opponent has not confirmed or statistics are flagged.");
    checkReport(report,f);
    if(f.tie_id){try{checkPlayoffReport(report,f,await getFixtures(t.id));}catch(e){fail((e as Error).message);}}
    status="finalized";finalizedAt=now();note=reason||"Organizer approved the confirmed result.";
  }else fail("Unknown review action.");
  const operation=id(),after={...f,status,report,note,submitted_by:submittedBy,submitted_manager:submittedManager,submitted_at:submittedAt,finalized_at:finalizedAt,version:f.version+1};
  const homePlayer=f.home_player_id??managerPlayer(t.id,c.clubs.find(cl=>cl.id===f.home)?.manager),awayPlayer=f.away_player_id??managerPlayer(t.id,c.clubs.find(cl=>cl.id===f.away)?.manager);
  const changed=await db().batch([
    query("UPDATE fixtures SET status=?,report=?,note=?,submitted_by=?,submitted_manager=?,submitted_at=?,finalized_at=?,version=version+1,mutation=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM proofs WHERE fixture_id=? AND category='final-score') AND (?<>'finalize' OR EXISTS(SELECT 1 FROM tournaments WHERE id=? AND locked_at IS NULL))",status,JSON.stringify(report),note,submittedBy,submittedManager,submittedAt,finalizedAt,operation,f.id,f.version,f.id,action,t.id),
    query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)',id(),t.id,f.id,user.userId,user.displayName,now(),action,reason||note||"Match report submitted.",JSON.stringify(f),JSON.stringify(after),f.id,operation),
    query("UPDATE tournaments SET revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)",t.id,f.id,operation),
    query("UPDATE fixtures SET home_player_id=?,away_player_id=? WHERE id=? AND mutation=? AND status='finalized'",homePlayer,awayPlayer,f.id,operation),
  ]);
  if(changed[0].meta.changes!==1)fail("The record or proof changed while you were saving. Refresh and try again.",409);
  if(status==="finalized"&&f.tie_id)autoAdvancePlayoffs(t.id,user);
  return json({ok:true});
}

export async function handle(request:Request,path:string[]):Promise<Response>{
  try{
    const user=await getCurrentUser();if(!user)fail("Sign in to use your tournament workspace.",401);
    if(request.method!=="GET"){
      if(!sameOrigin(request))fail("Cross-origin changes are not allowed.",403);
    }
    // Email is used only to accept the organizer's explicit pending membership.
    // Once accepted, authorization uses the stable, site-scoped user ID.
    if(!user.username&&user.email)await query("UPDATE members SET user_id=? WHERE email=? AND email<>'' AND username IS NULL AND user_id IS NULL",user.userId,user.email.toLowerCase()).run();
    const url=new URL(request.url);
    if(path.length===1&&path[0]==='profile'){
      if(request.method==='GET')return json(getProfile(user));
      if(request.method==='POST')return json(saveProfile(user,await body(request)));
      fail('Method not allowed.',405);
    }
    if(path[0]==='account'&&path[1]==='password'&&path.length===2){
      if(request.method!=='POST')fail('Method not allowed.',405);
      return json(await changePassword(user,await body(request)));
    }
    if(path[0]==='tiquicia'&&path.length===1){
      if(request.method==='GET')return json({players:listTiquicia(),canEdit:user.isOwner});
      if(request.method==='POST')return json(changeTiquicia(user,await body(request)));
      fail('Method not allowed.',405);
    }
    if(path[0]==='participation'&&path.length===1){
      if(request.method!=='POST')fail('Method not allowed.',405);
      return json(answerParticipation(user,await body(request)));
    }
    if(path[0]==='player-photo'&&path.length===2&&request.method==='GET'){
      const visible=await query('SELECT 1 FROM community_players p JOIN tournaments t ON t.owner_id=p.owner_id JOIN members m ON m.tournament_id=t.id AND m.user_id=? WHERE p.id=? LIMIT 1',user.userId,path[1]).first();
      if(!visible)fail('No picture.',404);
      const a=getPlayerPhoto(path[1]);if(!a)fail('No picture.',404);
      const etag=`"${a.version}-${a.size}"`,headers={ETag:etag,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
      if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
      return new Response(new Uint8Array(a.data),{headers:{...headers,'Content-Type':a.mime,'Content-Length':String(a.size),'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'"}});
    }
    if(path[0]==='avatar'){
      if(path.length===2&&request.method==='GET'){
        if(path[1]!==user.userId){
          const visible=await query('SELECT 1 FROM members own JOIN members other ON other.tournament_id=own.tournament_id WHERE own.user_id=? AND other.user_id=? LIMIT 1',user.userId,path[1]).first();
          if(!visible)fail('No picture.',404);
        }
        const a=getAvatar(path[1]);if(!a)fail('No picture.',404);
        const etag=`"${a.version}-${a.size}"`,headers={ETag:etag,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};
        if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
        return new Response(new Uint8Array(a.data),{headers:{...headers,'Content-Type':a.mime,'Content-Length':String(a.size),'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'"}});
      }
      if(path.length===1&&request.method==='GET')return json(avatarInfo(user.userId));
      if(path.length===1&&request.method==='POST'){
        const buffered=await bytes(request,AVATAR_UPLOAD_LIMIT+65536);
        const form=await new Request(request.url,{method:'POST',headers:request.headers,body:buffered}).formData().catch(()=>fail('Send the picture as a file.'));
        const file=form.get('file');if(!(file instanceof File)||file.size<64||file.size>AVATAR_UPLOAD_LIMIT)fail('Choose a JPEG, PNG or WebP picture up to 1 MB.');
        return json(saveAvatar(user.userId,new Uint8Array(await file.arrayBuffer())));
      }
      if(path.length===1&&request.method==='DELETE')return json(removeAvatar(user.userId));
      fail('Method not allowed.',405);
    }
    const profile=getProfile(user),onboardingRequired=!user.isOwner&&!profile.complete;
    if(onboardingRequired){
      if(path.length===1&&path[0]==='state'&&request.method==='GET')return json({user,profile,onboardingRequired:true,tournaments:[],tournament:null});
      fail('Complete your profile before using tournament workflows.',403);
    }
    if(path[0]==='accounts'&&path[1]==='participation'&&path.length===2){
      if(request.method!=='POST')fail('Method not allowed.',405);
      return json(decideParticipation(user,await body(request)));
    }
    if(path[0]==='accounts'&&path.length===2&&['disable','enable'].includes(path[1])){
      if(request.method!=='POST')fail('Method not allowed.',405);
      const input=await body(request);return json(path[1]==='disable'?disableAccount(user,input):enableAccount(user,input));
    }
    if(path[0]==='tournament'&&path[2]==='members'&&path[3]==='remove'&&path.length===4){
      if(request.method!=='POST')fail('Method not allowed.',405);
      return json(removeMember(path[1],user,await body(request)));
    }
    if(path.length===1&&path[0]==='friendlies'){
      if(request.method==='GET')return json(getFriendlies(user));
      if(request.method==='POST')return json(friendlyAction(user,await body(request)));
      fail('Method not allowed.',405);
    }
    if(path[0]==="state"&&request.method==="GET"){
      const choices=await all<{id:string;name:string;role:string}>("SELECT t.id,t.name,CASE WHEN a.owner=1 AND t.owner_id=m.user_id THEN 'admin' WHEN m.role IN ('manager','participant') THEN 'manager' ELSE 'viewer' END AS role FROM tournaments t JOIN members m ON m.tournament_id=t.id JOIN accounts a ON a.id=m.user_id WHERE m.user_id=? ORDER BY t.created_at DESC",user.userId).then(list=>isViewerByChoice(user.userId)?list.map(c=>c.role==="admin"?c:{...c,role:"viewer"}):list);
      const tid=url.searchParams.get("tournament")??choices[0]?.id;
      if(!tid)return json({user,profile,onboardingRequired:false,tournaments:[],tournament:null,seed,accountAccess:user.isOwner?accountDirectory(user):undefined});
      let member=await membership(user,tid);const t=await query("SELECT * FROM tournaments WHERE id=?",tid).first<Tournament>();if(!t)fail("Tournament not found.",404);
      ensurePlayers(t.owner_id);member=await membership(user,tid);
      const config=configSchema.parse(JSON.parse(t.config)),fixtures=await getFixtures(tid);
      const visibleFixtures=fixtures.map(f=>f.status==="finalized"||participant(member,f,config)?f:{...f,report:null,note:null,submitted_by:null});
      return json({user,profile,onboardingRequired:false,matchweeks:getMatchweeks(tid),tournaments:choices,tournament:{...t,config:maskUndrawnManagers(config,member.role==="admin"),awards:t.awards?JSON.parse(t.awards):null},member,fixtures:visibleFixtures,players:listPlayers(t.owner_id),rankings:communityRankings(t.owner_id),clubStars:getClubStars(tid),playerPhotos:photoVersions(t.owner_id),countries:memberCountries(tid,config,member.role==="admin"),season:(()=>{const x=getScheduleSettings(tid);return {start:x.season_start,end:x.season_end};})(),playoffs:listPlayoffs(tid),accountAccess:user.isOwner?accountDirectory(user):undefined,
        members:member.role==="admin"?(await all<Member>("SELECT * FROM members WHERE tournament_id=?",tid)).map(m=>({...m,role:tournamentRole(m.user_id===t.owner_id,m.user_id??'',t.owner_id,m.role)})):[],
        audit:member.role==="admin"?await all("SELECT * FROM audit WHERE tournament_id=? ORDER BY at DESC LIMIT 100",tid):[],
      });
    }
    if(path[0]==='accounts'&&path[1]==='username'&&path.length===2&&request.method==='POST'){
      if(!user.isOwner)fail('Only the owner can assign usernames.',403);
      return json(assignUsername(user,await body(request)));
    }
    if(path[0]==='accounts'&&path.length===2&&request.method==='POST'&&['rename-username','reset-password'].includes(path[1])){
      const input=z.object({accountId:z.string().min(1),username:z.string().optional()}).parse(await body(request));
      if(path[1]==='rename-username')return json(renameAccountUsername(database(),user.userId,input.accountId,input.username??''));
      return json(issuePasswordReset(database(),user.userId,input.accountId));
    }
    if(path[0]==="create"&&request.method==="POST"){
      if(!user.isOwner)fail("Only the organizer can create tournaments.",403);
      const data=await body(request),c=configSchema.parse(data.config??{...seed,name:data.name||seed.name});
      const tid=id();await db().batch([
        query("INSERT INTO tournaments(id,name,owner_id,config,created_at) VALUES(?,?,?,?,?)",tid,c.name,user.userId,JSON.stringify(c),now()),
        query("INSERT INTO members(id,tournament_id,user_id,email,name,role,manager_id,username) VALUES(?,?,?,?,?,'admin',?,?)",id(),tid,user.userId,user.email.toLowerCase(),user.displayName,c.managers.find(m=>m.id==="max")?.id??null,user.username),
        auditInsert(tid,user,"create","Tournament created.",null,{name:c.name,clubs:c.clubs.length}),
      ]);return json({id:tid});
    }
    if(path[0]==="proof"&&path[1]){
      const p=await query("SELECT * FROM proofs WHERE id=?",path[1]).first<{id:string;fixture_id:string;tournament_id:string;key:string;mime:string;uploader:string;category:string}>();if(!p)fail("Screenshot not found.",404);
      const m=await membership(user,p.tournament_id),t=await query("SELECT * FROM tournaments WHERE id=?",p.tournament_id).first<Tournament>();
      const raw=await query("SELECT * FROM fixtures WHERE id=?",p.fixture_id).first<Record<string,unknown>>();if(!t||!raw)fail("Match not found.",404);const f=unpack(raw);requireParticipant(m,f,JSON.parse(t.config));
      if(request.method==="GET"){
        const object=await proofStore.get(p.key);if(!object)fail("Screenshot unavailable.",404);
        return new Response(object.body,{headers:{"Content-Type":p.mime,"Content-Disposition":"inline","X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Content-Security-Policy":"default-src 'none'"}});
      }
      if(request.method==="DELETE"){
        if(f.status==="finalized"||!['scheduled','correction'].includes(f.status))fail("Proof is preserved while a report is under review or finalized.");
        if(p.uploader!==user.userId&&m.role!=="admin")fail("Only the uploader or organizer may remove this proof.",403);
        const result=await db().batch([
          query("DELETE FROM proofs WHERE id=? AND EXISTS(SELECT 1 FROM fixtures WHERE id=? AND status IN ('scheduled','correction'))",p.id,f.id),
          query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=1',id(),t.id,f.id,user.userId,user.displayName,now(),"remove-proof","Removed before submission/finalization.",JSON.stringify({proofId:p.id,category:p.category}),"null"),
        ]);
        if(result[0].meta.changes!==1)fail("The match changed. Refresh before removing proof.",409);
        await proofStore.delete(p.key);return json({ok:true});
      }
    }
    const tid=path[1];if(path[0]!=="tournament"||!tid)fail("Endpoint not found.",404);
    const m=await membership(user,tid),t=await query("SELECT * FROM tournaments WHERE id=?",tid).first<Tournament>();if(!t)fail("Tournament not found.",404);
    if(path.length===3&&path[2]==='delete'){
      if(request.method!=='POST')fail('Method not allowed.',405);
      admin(m);
      if(!user.isOwner||t.owner_id!==user.userId)fail('Only the owner can delete this tournament.',403);
      const input=z.object({name:z.string().min(1).max(200)}).parse(await body(request));
      return json(await deleteTournament(user.userId,tid,input.name));
    }
    ensurePlayers(t.owner_id);
    Object.assign(m,await membership(user,tid));
    const c=configSchema.parse(JSON.parse(t.config));
    if(path[2]==="export"&&request.method==="GET"){
      admin(m);
      const fs=await getFixtures(tid),kind=url.searchParams.get("kind")??"matches";
      let rows:Record<string,unknown>[];
      if(kind==="clubs")rows=standings(c,fs,"all");
      else if(kind==='elo')rows=communityRankings(t.owner_id).map(p=>({rank:p.rank,player:p.name,elo:p.rating,ratedResults:p.played,wins:p.wins,draws:p.draws,losses:p.losses,lastChange:p.lastChange,peak:p.peak}));
      else if(kind==='qualifiers')rows=listPlayoffs(tid).filter(p=>p.status==='complete').flatMap(p=>p.qualified.map(pid=>{const entrant=p.entrants.find(e=>e.id===pid)!;return {playoff:p.name,playerId:pid,player:entrant.name,seed:entrant.seed,eloAtDraw:entrant.rating,qualifyingPlaces:p.target};}));
      else if(kind==="managers")rows=managerRows(c,fs);
      else if(kind==="players")rows=playerRows(c,fs);
      else if(kind==="awards")rows=(t.awards?JSON.parse(t.awards):awards(c,fs)).map((a:ReturnType<typeof awards>[number])=>({award:a.name,rule:a.rule,winners:a.leaders.map(l=>l.name).join("; "),value:a.leaders[0]?.value??"",lockedAt:t.locked_at}));
      else if(kind==="audit"){admin(m);rows=await all('SELECT * FROM audit WHERE tournament_id=? ORDER BY at',tid);}
      else if(kind==="proofs"){admin(m);rows=await all("SELECT id,fixture_id,uploader,uploaded_at,category,name,mime,size FROM proofs WHERE tournament_id=?",tid);}
      else rows=fs.filter(f=>f.status==="finalized"&&f.report).map(f=>({fixture:f.id,home:fixtureSide(f,'home',c,listPlayers(t.owner_id)).name,away:fixtureSide(f,'away',c,listPlayers(t.owner_id)).name,stage:f.stage,matchday:f.matchday,tie:f.tie_id,leg:f.leg,finalizedAt:f.finalized_at,...f.report}));
      return new Response('\uFEFF'+csv(rows),{headers:{"Content-Type":"text/csv;charset=utf-8","Content-Disposition":`attachment; filename="matchroom-${['elo','qualifiers','clubs','managers','players','awards','audit','proofs'].includes(kind)?kind:'matches'}.csv"`,"Cache-Control":"no-store"}});
    }
    if(path[2]==='schedule'&&path.length===3&&request.method==='GET')return json(getSchedule(t,m));
    if(path[2]==="fixture"&&path[3]){
      const raw=await query("SELECT * FROM fixtures WHERE id=? AND tournament_id=?",path[3],tid).first<Record<string,unknown>>();if(!raw)fail("Fixture not found.",404);const f=unpack(raw);requireParticipant(m,f,c);
      if(path[4]==='scheduling'&&request.method==='POST')return json(scheduleAction(t,m,user,f.id,await body(request)));
      if(path[4]==="schedule"&&request.method==="POST"){
        admin(m);
        const input=z.object({version:z.number().int(),matchday:z.number().int().min(1).max(100),scheduled:z.string().datetime().nullable()}).parse(await body(request));
        if(f.status!=="scheduled")fail("Only fixtures awaiting their first report can be rescheduled.");
        const op=id();const saved=await db().batch([
          query("UPDATE fixtures SET matchday=?,scheduled=?,version=version+1,mutation=? WHERE id=? AND version=? AND status='scheduled' AND EXISTS(SELECT 1 FROM tournaments WHERE id=? AND locked_at IS NULL)",input.matchday,input.scheduled,op,f.id,input.version,tid),
          query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)',id(),tid,f.id,user.userId,user.displayName,now(),"reschedule","Organizer updated the fixture calendar.",JSON.stringify({matchday:f.matchday,scheduled:f.scheduled}),JSON.stringify(input),f.id,op),
          query("INSERT INTO schedule_events(id,tournament_id,fixture_id,proposal_id,actor_id,actor_name,at,action,reason,kickoff_before,kickoff_after,proposed_at) SELECT lower(hex(randomblob(16))),tournament_id,fixture_id,id,?,?,?,'superseded','Owner set the kickoff directly.',?,?,proposed_at FROM schedule_proposals WHERE fixture_id=? AND status IN ('awaiting_opponent','awaiting_owner') AND EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)",user.userId,user.displayName,now(),f.scheduled,input.scheduled,f.id,f.id,op),
          query("UPDATE schedule_proposals SET status='superseded',version=version+1,decided_at=? WHERE fixture_id=? AND status IN ('awaiting_opponent','awaiting_owner') AND EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)",now(),f.id,f.id,op),
          query("UPDATE tournaments SET revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM fixtures WHERE id=? AND mutation=?)",tid,f.id,op),
        ]);
        if(saved[0].meta.changes!==1)fail("The fixture changed or awards are locked. Refresh before scheduling.",409);
        return json({ok:true});
      }
      if(path[4]==="proofs"){
        if(request.method==="GET")return json(await all("SELECT id,name,category,mime,size,uploader,uploaded_at FROM proofs WHERE fixture_id=? ORDER BY uploaded_at",f.id));
        if(request.method==="POST"){
          requireOpenMatchweek(tid,f);
          if(!['scheduled','correction'].includes(f.status))fail("Proof can be added before submission or after a correction request.");

          const buffered=await bytes(request,8*1024*1024+65536);
          const form=await new Request(request.url,{method:"POST",headers:request.headers,body:buffered}).formData();
          const file=form.get("file"),category=String(form.get("category"));
          if(!(file instanceof File)||file.size<12||file.size>8*1024*1024)fail("Choose a JPEG, PNG or WebP image up to 8 MB.");
          if(!['final-score','match-facts','players','shootout'].includes(category))fail("Choose a proof category.");
          const contents=await file.arrayBuffer(),head=new Uint8Array(contents),ascii=(a:number,b:number)=>new TextDecoder().decode(head.slice(a,b));
          const mime=head[0]===255&&head[1]===216&&head[2]===255?'image/jpeg':head[0]===137&&ascii(1,4)==='PNG'&&head[4]===13&&head[5]===10&&head[6]===26&&head[7]===10?'image/png':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':null;
          if(!mime)fail("The file is not a supported image. SVG and renamed files are not accepted.");
          const count=await query("SELECT COUNT(*) AS n FROM proofs WHERE fixture_id=?",f.id).first<{n:number}>();if((count?.n??0)>=12)fail("This match already has 12 proof images.");
          const pid=id(),key=`${tid}/${f.id}/${pid}`,at=now();await proofStore.put(key,contents);
          try{
            const saved=await db().batch([
              query("INSERT INTO proofs(id,tournament_id,fixture_id,uploader,uploaded_at,category,name,mime,size,key) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM fixtures WHERE id=? AND version=? AND status IN ('scheduled','correction')) AND (SELECT COUNT(*) FROM proofs WHERE fixture_id=?)<12",pid,tid,f.id,user.userId,at,category,file.name.slice(0,120),mime,file.size,key,f.id,f.version,f.id),
              query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM proofs WHERE id=?)',id(),tid,f.id,user.userId,user.displayName,at,"upload-proof","Original image stored.","null",JSON.stringify({id:pid,category,size:file.size}),pid),
            ]);if(saved[0].meta.changes!==1)fail("The report changed during upload. Reopen it.",409);
          }catch(e){await proofStore.delete(key);throw e;}
          return json({id:pid});
        }
      }
      if(request.method==="POST")return changeFixture(t,m,user,f,await body(request));
    }
    if(path[2]==='join-link'&&path.length===3&&request.method==='GET'){admin(m);return json(getJoinLink(tid,user));}
    if(path[2]==='team-playoffs'&&path.length===3&&request.method==='GET')return json(getTeamPlayoff(tid));
    if(path[2]==='squads'&&path.length===3&&request.method==='GET')return json(listSquads(tid,user,{role:m.role,managerId:m.manager_id}));
    if(path[2]==='squads'&&path.length===4&&path[3]==='open'&&request.method==='POST')return json(setSquadsOpen(tid,user,{role:m.role,managerId:m.manager_id},await body(request)));
    if(path[2]==='squads'&&request.method==='POST'&&(path.length===3||(path.length===4&&path[3]==='delete'))){
      const who={role:m.role,managerId:m.manager_id},input=await body(request);
      return json(path.length===3?saveSquad(tid,user,who,input):deleteSquad(tid,user,who,input));
    }
    if(request.method!=="POST")fail("Endpoint not found.",404);
    admin(m);const data=await body(request);
    if(path[2]==='team-playoffs'&&path.length===3)return json(createTeamPlayoff(tid,user,data));
    if(path[2]==='team-playoffs'&&path.length===4&&path[3]==='result')return json(recordTeamTie(tid,user,data));
    if(path[2]==='team-playoffs'&&path.length===4&&path[3]==='simulate')return json(simulateTeamPlayoff(tid,user,data));
    if(path[2]==='team-playoffs'&&path.length===4&&path[3]==='cancel')return json(cancelTeamPlayoff(tid,user,data));
    if(path[2]==='matchweeks'&&path.length===3)return json(changeMatchweeks(tid,user,data));
    if(path[2]==='schedule'&&path.length===4)return json(scheduleAdmin(tid,user,path[3],data));
    if(path[2]==='users')return json(createPlayerUser(tid,user,data));
    if(path[2]==='join-link'&&path.length===3)return json(saveJoinLink(tid,user,data));
    if(path[2]==='add-account'&&path.length===3)return json(addAccountToTournament(tid,user,data));
    if(path[2]==='viewers')return json(authorizeViewer(tid,user,data));
    if(path[2]==='players'&&path.length===3)return json(addPlayer(tid,user,data));
    if(path[2]==='players'&&path.length===4&&path[3]==='update')return json(updatePlayer(tid,user,data));
    if(path[2]==='players'&&path.length===4&&path[3]==='delete')return json(deletePlayer(tid,user,data));
    if(path[2]==='player-photo'&&path.length===3){
      const d=z.object({playerId:z.string(),image:z.string().max(700000).nullable()}).parse(data);
      const m2=d.image===null?null:/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(d.image);
      if(d.image!==null&&!m2)fail('Send a JPEG, PNG or WebP picture.');
      return json(setPlayerPhoto(t.owner_id,d.playerId,m2?new Uint8Array(Buffer.from(m2[2],'base64')):null));
    }
    if(path[2]==='club-stars'&&!path[3])return json(setClubStars(tid,user,data));
    if(path[2]==='playoffs'&&!path[3])return json(createPlayoff(tid,user,data));
    if(path[2]==='playoffs'&&path[3]&&path[4]==='cancel')return json(cancelPlayoff(tid,path[3],user,data));
    if(path[2]==='playoffs'&&path[3]&&path[4]==='advance')return json(advancePlayoff(tid,path[3],user,data));
    if(path[2]==='invite'&&data.playerId)return json(authorizePlayer(tid,user,data));
    if(path[2]==="fixtures"){
      if(t.locked_at)fail("Unlock the awards before adding fixtures.");
      const input=z.object({home:z.string(),away:z.string(),stage:z.enum(["league","final"]),matchday:z.number().int().min(1).max(100),scheduled:z.string().datetime().nullable()}).parse(data);
      if(input.home===input.away||![input.home,input.away].every(cid=>c.clubs.some(cl=>cl.id===cid)))fail("Choose two different clubs.");
      const home=c.clubs.find(cl=>cl.id===input.home)!,away=c.clubs.find(cl=>cl.id===input.away)!;
      if(!home.manager||!away.manager)fail("Import the completed manager draw before scheduling these clubs, so their managers can submit and confirm results.");
      if(c.leaguePhase?.forbidSameManager&&home.manager&&home.manager===away.manager)fail("Clubs managed by the same manager cannot meet.");
      const fixture=id();const saved=await db().batch([
        query("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday,scheduled) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tournaments WHERE id=? AND locked_at IS NULL AND revision=?)",fixture,tid,input.home,input.away,input.stage,input.matchday,input.scheduled,tid,t.revision),
        query('INSERT INTO audit(id,tournament_id,fixture_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM fixtures WHERE id=?)',id(),tid,fixture,user.userId,user.displayName,now(),"create-fixture","Fixture scheduled.","null",JSON.stringify(input),fixture),
        query("UPDATE tournaments SET revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM fixtures WHERE id=?)",tid,fixture),
      ]);if(saved[0].meta.changes!==1)fail("The tournament changed. Refresh and try again.",409);return json({ok:true});
    }
    if(path[2]==="invite"){
      const managerId=z.string().min(1).parse(data.managerId);
      const playerId=managerPlayer(tid,managerId);
      if(!playerId||!c.managers.some(manager=>manager.id===managerId))fail('Choose an existing manager.');
      return json(authorizePlayer(tid,user,{...data,playerId}));
    }
    if(path[2]==="awards"){
      const fs=await getFixtures(tid),reason=String(data.reason??"").trim().slice(0,2000);
      if(data.action==="lock"){
        if(listPlayoffs(tid).some(p=>p.status==='active'))fail('Finish the active playoff before locking tournament awards.');
        if(t.locked_at)fail("Awards are already locked.");if(!fs.some(f=>f.status==="finalized"))fail("Finalize at least one match first.");
        if(fs.some(f=>f.status!=="finalized"))fail("Finalize every scheduled fixture before locking tournament awards.");
        const snapshot=awards(c,fs),at=now();
        const res=await db().batch([query("UPDATE tournaments SET awards=?,locked_at=?,revision=revision+1 WHERE id=? AND revision=? AND locked_at IS NULL",JSON.stringify(snapshot),at,tid,t.revision),
          query('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tournaments WHERE id=? AND locked_at=?)',id(),tid,user.userId,user.displayName,at,"lock-awards",reason||"Tournament awards locked.","null",JSON.stringify(snapshot),tid,at)]);
        if(res[0].meta.changes!==1)fail("The tournament changed; refresh before locking awards.",409);
      }else if(data.action==="unlock"){
        if(!t.locked_at)fail("Awards are not locked.");if(!reason)fail("Explain why you are unlocking the awards.");
        const saved=await db().batch([query("UPDATE tournaments SET awards=NULL,locked_at=NULL,revision=revision+1 WHERE id=? AND revision=? AND locked_at IS NOT NULL",tid,t.revision),query('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1',id(),tid,user.userId,user.displayName,now(),"unlock-awards",reason,JSON.stringify({awards:JSON.parse(t.awards??"[]"),lockedAt:t.locked_at}),"null")]);
        if(saved[0].meta.changes!==1)fail("The award snapshot changed. Refresh before unlocking.",409);
      }else fail("Unknown awards action.");return json({ok:true});
    }
    if(path[2]==="import"){
      const fs=await getFixtures(tid);if(fs.length)fail("Import the draw before adding fixtures. Create a new tournament to import another draw.");
      const input=data.data;
      async function saveConfig(next:Config,action:string,details:unknown){
        const op=id();const saved=await db().batch([
          query("UPDATE tournaments SET name=?,config=?,revision=revision+1,mutation=? WHERE id=? AND revision=? AND locked_at IS NULL AND NOT EXISTS(SELECT 1 FROM fixtures WHERE tournament_id=?)",next.name,JSON.stringify(next),op,tid,t!.revision,tid),
          query('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tournaments WHERE id=? AND mutation=?)',id(),tid,user!.userId,user!.displayName,now(),action,"Completed Unity data imported.",t!.config,JSON.stringify(details),tid,op),
        ]);if(saved[0].meta.changes!==1)fail("The tournament changed. Refresh before importing.",409);
      }
      if(input?.clubs){
        const parsed=configSchema.parse(input);
        const currentMembers=await all<Member>("SELECT * FROM members WHERE tournament_id=?",tid);
        if(currentMembers.some(member=>member.manager_id&&!parsed.managers.some(manager=>manager.id===member.manager_id)))fail("The config removes an assigned manager. Start a new tournament for a different manager list.");
        await saveConfig(parsed,"import-config",parsed);return json({ok:true});
      }
      if(input?.exportFormatVersion!==1||input.complete!==true||input.tournamentId!==c.tournamentId)fail("Use a complete Unity draw export for this tournament (format version 1).");
      if(c.clubs.some(cl=>cl.pot==="pending"))fail("Complete qualification and the pot vote before importing a draw.");
      if(input.mode==="ManagerClubs"){
        const assignments=z.array(z.object({clubId:z.string(),managerId:z.string()})).parse(input.results?.assignments);
        if(assignments.length!==c.clubs.length||new Set(assignments.map(a=>a.clubId)).size!==c.clubs.length)fail("The assignment file must contain every club exactly once.");
        for(const a of assignments){const club=c.clubs.find(cl=>cl.id===a.clubId);if(!club||!c.managers.some(manager=>manager.id===a.managerId))fail("Unknown club or manager in draw.");club.manager=a.managerId;}
        for(const manager of c.managers){const own=c.clubs.filter(cl=>cl.manager===manager.id);if(own.length!==(c.managerDraw?.clubsPerManager??3))fail("A manager has an unexpected number of clubs.");if(c.managerDraw?.distinctPots!==false&&new Set(own.map(cl=>cl.pot)).size!==own.length)fail("A manager has multiple clubs from the same pot.");}
        await saveConfig(c,"import-assignments",{config:c,seed:input.seed,configHash:input.configHash,engineVersion:input.engineVersion});return json({ok:true});
      }
      if(input.mode!=="LeaguePhase")fail("Unsupported Unity draw mode.");
      if(c.clubs.some(cl=>!cl.manager))fail("Import the manager assignments or a config with assigned managers first.");
      const pairs=z.array(z.object({homeClubId:z.string(),awayClubId:z.string(),drawIndex:z.number().int()})).min(1).max(1000).parse(input.results?.fixtures);
      const seen=new Set<string>();
      for(const p of pairs){const home=c.clubs.find(cl=>cl.id===p.homeClubId),away=c.clubs.find(cl=>cl.id===p.awayClubId),key=[p.homeClubId,p.awayClubId].sort().join("/");
        if(!home||!away||home.id===away.id||seen.has(key))fail("The draw contains an unknown, repeated or self pairing.");seen.add(key);
        if(c.leaguePhase?.forbidSameManager&&home.manager===away.manager)fail("The draw contains a same-manager pairing.");
        if(c.leaguePhase?.forbidSameCountry&&home.country&&home.country===away.country)fail("The draw contains a same-country pairing.");
      }
      for(const club of c.clubs){
        const own=pairs.filter(p=>p.homeClubId===club.id||p.awayClubId===club.id);
        for(const pot of c.pots){const homes=own.filter(p=>p.homeClubId===club.id&&c.clubs.find(cl=>cl.id===p.awayClubId)?.pot===pot.id).length,aways=own.filter(p=>p.awayClubId===club.id&&c.clubs.find(cl=>cl.id===p.homeClubId)?.pot===pot.id).length;if(homes!==(c.leaguePhase?.homePerPot??1)||aways!==(c.leaguePhase?.awayPerPot??1))fail(`Incomplete home/away pot quotas for ${club.name}.`);}
        const cap=c.leaguePhase?.maxOpponentsPerCountry??0;if(cap){const counts:Record<string,number>={};for(const p of own){const country=c.clubs.find(cl=>cl.id===(p.homeClubId===club.id?p.awayClubId:p.homeClubId))?.country;if(country&&(counts[country]=(counts[country]??0)+1)>cap)fail(`Country limit exceeded for ${club.name}.`);}}
      }
      // The Unity export supplies pairings, not calendar matchdays. Keep them
      // together in an unscheduled draw round instead of fabricating an order.
      const op=id();const saved=await db().batch([
        query("UPDATE tournaments SET revision=revision+1,mutation=? WHERE id=? AND revision=? AND locked_at IS NULL AND NOT EXISTS(SELECT 1 FROM fixtures WHERE tournament_id=?)",op,tid,t.revision,tid),
        ...pairs.map(p=>query("INSERT INTO fixtures(id,tournament_id,home,away,stage,matchday) SELECT ?,?,?,?,'league',1 WHERE EXISTS(SELECT 1 FROM tournaments WHERE id=? AND mutation=?)",id(),tid,p.homeClubId,p.awayClubId,tid,op)),
        query('INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after") SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tournaments WHERE id=? AND mutation=?)',id(),tid,user.userId,user.displayName,now(),"import-fixtures","Unity pairings imported; schedule to be assigned.","null",JSON.stringify({seed:input.seed,configHash:input.configHash,engineVersion:input.engineVersion,fixtures:pairs.length}),tid,op),
      ]);if(saved[0].meta.changes!==1)fail("The tournament changed. Refresh before importing fixtures.",409);return json({ok:true});
    }
    fail("Endpoint not found.",404);
  }catch(error){
    if(error instanceof Error&&error.message.startsWith('Matchweek'))return json({error:error.message},409);
    if(error instanceof CompetitionError||error instanceof AccountAccessError||error instanceof AccountRecoveryError||error instanceof TournamentDeletionError)return json({error:error.message},error.status);
    if(error instanceof HttpError)return json({error:error.message},error.status);
    if(error instanceof z.ZodError)return json({error:error.issues.slice(0,3).map(i=>`${i.path.join(".")}: ${i.message}`).join(" · ")},400);
    if(error instanceof Error&&(/UNIQUE constraint/.test(error.message)))return json({error:"That fixture or membership already exists."},409);
    console.error("Tournament request failed",error);return json({error:"The change could not be saved. Please retry."},500);
  }
}


import {normalizeName} from './asset-teams';

/** How good a fixture could be: both clubs' strength (stars) and both managers' Elo, plus how evenly matched they are. */
export type MatchQuality={score:number;tier:'big'|'good'|'standard';homeStars?:number;awayStars?:number;homeElo?:number;awayElo?:number;detail:string};

// [names the club may be typed as, EA FC 27 overall, stars]. Stars are the published ones for the top clubs and banded from the overall for the rest.
// The organizer's own star pick in the app (Clubs tab) always wins over this table.
const RATINGS:[string[],number,number][]=[
  [['Barcelona','FC Barcelona'],86,5],[['Real Madrid'],86,5],[['Bayern Munich','Bayern','FC Bayern München'],86,5],[['Paris Saint-Germain','PSG','Paris SG'],86,5],
  [['Manchester City','Man City'],85,5],[['Liverpool','Liverpool FC'],85,5],[['Arsenal','Arsenal FC'],84,5],[['Inter','Inter Milan','Internazionale'],83,5],
  [['Manchester United','Man United','Man Utd'],82,4.5],[['Borussia Dortmund','Dortmund'],82,4.5],[['Chelsea','Chelsea FC'],81,4.5],[['Tottenham Hotspur','Tottenham','Spurs'],81,4.5],
  [['Napoli','SSC Napoli'],81,4.5],[['AS Roma','Roma'],81,4.5],[['Atlético Madrid','Atletico Madrid','Atlético de Madrid','Atletico','Atleti'],81,5],
  [['Newcastle United','Newcastle'],81,4.5],[['Bayer Leverkusen','Leverkusen'],81,4.5],[['Galatasaray'],81,4.5],[['Benfica','SL Benfica'],80,4.5],
  [['Athletic Club','Athletic Bilbao'],79,4],[['Deportivo La Coruña','Deportivo La Coruna','Deportivo','RC Deportivo'],79,4],[['Real Betis','Betis'],79,4],[['Villarreal','Villarreal CF'],79,4],
  [['Como','Como 1907'],79,4],[['AC Milan','Milan'],79,4],[['Aston Villa'],78,4.5],[['Juventus'],78,4.5],[['Real Sociedad'],78,4],[['Celta Vigo','Celta'],78,4],
  [['PSV Eindhoven','PSV'],78,4],[['FC Porto','Porto'],78,4],[['RB Leipzig','Leipzig'],77,4],[['Lille','LOSC Lille','LOSC'],77,4],[['Eintracht Frankfurt','Frankfurt'],76,4],
  [['Monaco','AS Monaco'],76,4],[['Lens','RC Lens'],76,4],[['Ajax'],76,4],[['Beşiktaş','Besiktas'],76,4],[['Sevilla','Sevilla FC'],75,4],[['Marseille','Olympique de Marseille'],75,4],
  [['Fiorentina','ACF Fiorentina'],73,3.5],[['Sparta Praha','Sparta Prague','AC Sparta Praha'],73,3.5],[['Viktoria Plzeň','Viktoria Plzen'],72,3.5],[['Club Brugge'],72,3.5],
  [['Young Boys','BSC Young Boys'],71,3.5],[['Bodø/Glimt','Bodo Glimt','FK Bodø/Glimt'],71,3.5],[['Brøndby','Brondby','Brøndby IF','Brondby IF'],68,3.5],
];
const exact=new Map<string,{ovr:number;stars:number;words:string[]}>();
for(const [names,ovr,stars] of RATINGS)for(const n of names){const k=normalizeName(n);exact.set(k,{ovr,stars,words:k.split(' ')});}
/** Overall and stars for a club name, or null when the table has no such club. */
export function clubRating(name:string|undefined):{ovr:number;stars:number}|null{
  const k=normalizeName(name);if(!k)return null;
  const hit=exact.get(k);if(hit)return hit;
  const words=new Set(k.split(' '));let best:{ovr:number;stars:number;words:string[]}|null=null;
  for(const r of exact.values())if(r.words.every(w=>words.has(w))&&(!best||r.words.length>best.words.length))best=r;
  return best;
}

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
type Side={name?:string;stars?:number|null;elo?:number|null};
export function matchQuality(home:Side,away:Side):MatchQuality|null{
  const hs=home.stars??clubRating(home.name)?.stars,as=away.stars??clubRating(away.name)?.stars;
  const he=home.elo??undefined,ae=away.elo??undefined;
  const stars=hs!=null&&as!=null,elo=he!=null&&ae!=null;
  if(!stars&&!elo)return null;
  const starsPart=stars?((hs!+as!)/2)/5:0,starClose=stars?1-Math.abs(hs!-as!)/4.5:0;
  const eloPart=elo?clamp(((he!+ae!)/2-950)/300):0,eloClose=elo?1-Math.min(Math.abs(he!-ae!),300)/300:0;
  // Missing Elo counts as everyone still on the starting rating, so a game is not scored higher just because Elo is unknown.
  const raw=stars?.45*starsPart+.25*(elo?eloPart:.17)+.15*starClose+.15*(elo?eloClose:1):.6*eloPart+.4*eloClose;
  const score=Math.round(raw*100),tier=score>=74?'big':score>=62?'good':'standard';
  const detail=[stars?`★ ${hs} v ${as}`:'',elo?`Elo ${Math.round(he!)} v ${Math.round(ae!)}`:''].filter(Boolean).join(' · ');
  return {score,tier,homeStars:hs??undefined,awayStars:as??undefined,homeElo:he,awayElo:ae,detail};
}

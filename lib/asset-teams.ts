// Club names in the owner's FC DB Editor asset pack (47 clubs). Crests live in /public/clubs/<id>.webp.
// Each club lists every name it may be typed as; matching ignores accents, case and punctuation.
export const assetTeams: Record<string, string[]> = {"10": ["Man City","Manchester City"],"9": ["Liverpool","Liverpool FC"],"2": ["A. Villa","Aston Villa","Villa"],"11": ["Man United","Man Utd","Manchester United"],"1": ["Arsenal","Arsenal FC"],"240": ["At. Madrid","Atleti","Atletico","Atletico Madrid","Atlético de Madrid"],"241": ["Barca","Barcelona","Barça","FC Barcelona"],"449": ["Betis","R. Betis","Real Betis","Real Betis Balompié"],"243": ["R. Madrid","Real Madrid"],"483": ["Villarreal","Villarreal CF"],"21": ["Bayern","Bayern Munich","Bayern München","FC Bayern","FC Bayern München"],"22": ["BVB","Borussia Dortmund","Dortmund"],"112172": ["Leipzig","RB Leipzig"],"1745": ["Como","Como 1907"],"131682": ["FC Internazionale Milano","Inter","Inter Milan","Internazionale"],"48": ["Napoli","SSC Napoli"],"52": ["AS Roma","Roma"],"64": ["Lens","RC Lens"],"65": ["LOSC","LOSC Lille","Lille"],"73": ["PSG","Paris SG","Paris Saint Germain","Paris Saint-Germain"],"918": ["Bodo Glimt","Bodo/Glimt","Bodø/Glimt","FK Bodo Glimt","FK Bodø/Glimt"],"448": ["Athletic","Athletic Bilbao","Athletic Club","Athletic Club Bilbao","Athletic Club de Bilbao"],"245": ["Ajax"],"5": ["Chelsea","Chelsea FC"],"242": ["Deportivo","Deportivo La Coruna","RC Deportivo"],"325": ["Galatasaray","Galatasaray SK"],"13": ["Newcastle","Newcastle United","Newcastle Utd"],"247": ["PSV","PSV Eindhoven"],"110468": ["FC Viktoria Plzeň","Plzen","Plzeň","Viktoria Plzen","Viktoria Plzeň"],"131681": ["AC Milan","Milan","Milano FC"],"234": ["Benfica","SL Benfica"],"231": ["Brugge","Cl. Brugge","Club Brugge","Club Brugge KV"],"457": ["R. Sociedad","Real Sociedad","Sociedad"],"32": ["Bayer 04 Leverkusen","Leverkusen"],"327": ["Besiktas","Beşiktaş","Beşiktaş JK"],"1824": ["Eintracht Frankfurt","Frankfurt"],"110374": ["ACF Fiorentina","Fiorentina"],"45": ["Juve","Juventus","Juventus FC"],"18": ["Spurs","Tottenham","Tottenham Hotspur"],"69": ["AS Monaco","Monaco"],"267": ["AC Sparta Praha","Sp. Praha","Sparta Prague","Sparta Praha"],"481": ["Sevilla","Sevilla FC"],"219": ["Marseille","OM","Olympique de Marseille"],"900": ["BSC Young Boys","Young Boys"],"269": ["Brondby","Brondby IF","Brøndby","Brøndby IF"],"450": ["Celta","Celta Vigo","Celta de Vigo","RC Celta de Vigo","Real Club Celta de Vigo"],"236": ["FC Porto","Porto"]};
const strip = new Set(['fc','cf','ac','sc','afc','ssc','sl','fk','bsc','jk','sk','if','rc','as','1907','cd','ud','sv','kv']);
export const normalizeName = (s: string | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const loose = (s: string) => normalizeName(s).split(' ').filter(w => !strip.has(w)).join(' ');
let exact: Map<string, string> | null = null, fuzzy: Map<string, string> | null = null;
function build() {
  exact = new Map(); fuzzy = new Map();
  for (const [id, names] of Object.entries(assetTeams)) for (const n of names) {
    exact.set(normalizeName(n), id);
    const l = loose(n); if (l && !fuzzy.has(l)) fuzzy.set(l, id);
  }
}
/** The asset-pack club id for a tournament club name, or null when the pack has no such club. */
export function assetTeamId(name: string | undefined): string | null {
  if (!name) return null;
  if (!exact) build();
  return exact!.get(normalizeName(name)) ?? fuzzy!.get(loose(name)) ?? null;
}
export const crestUrl = (name: string | undefined) => { const id = assetTeamId(name); return id ? `/clubs/${id}.webp` : null; };

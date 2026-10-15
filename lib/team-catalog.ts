// Extra clubs offered in the My Profile team picker, beyond the draw-ceremony clubs in data/draw-config.json.
// Names follow the short style used there. The list is not tied to any league season; people can still add any other team by name.
export const extraClubs=[
  'Chelsea','Man United','Tottenham','West Ham','Everton','Leicester City','Brighton','Wolves','Crystal Palace','Fulham','Brentford','Nottingham Forest','Leeds United','Southampton','Sunderland',
  'Roma','Lazio','Napoli','Fiorentina','Torino','Genoa','Udinese',
  'Sevilla','Real Betis','Real Sociedad','Valencia','Villarreal','Athletic Club','Celta Vigo','Osasuna',
  'Marseille','Lyon','Rennes','Nice','Lens','Nantes',
  'Eintracht Frankfurt','Wolfsburg','Borussia Monchengladbach','Werder Bremen','Union Berlin','Freiburg','Hoffenheim','Mainz',
  'Ajax','AZ Alkmaar','Twente','Porto','Braga','Besiktas','Galatasaray','Fenerbahce','Olympiacos','Panathinaikos','Rangers','Anderlecht','Genk','FC Copenhagen','Basel','Rapid Wien','Ludogorets','Dynamo Kyiv',
  'Saprissa','Alajuelense','Herediano','Cartagines','Perez Zeledon','Guadalupe FC','Municipal Liberia','San Carlos',
  'LA Galaxy','LAFC','Inter Miami','Seattle Sounders','Atlanta United','New York Red Bulls','New York City FC','Portland Timbers','Toronto FC','Columbus Crew','FC Cincinnati',
  'Club America','Chivas','Cruz Azul','Pumas UNAM','Tigres UANL','Monterrey','Toluca','Santos Laguna','Leon','Pachuca',
  'Boca Juniors','River Plate','Flamengo','Palmeiras','Santos','Corinthians','Sao Paulo','Fluminense','Independiente','Racing Club','Penarol','Nacional','Colo-Colo','Atletico Nacional',
  'Al Nassr','Al Hilal','Al Ittihad',
];
const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
/** Football clubs from the draw plus the extra catalog, de-duplicated and sorted, with RB Tiquicia first. */
export function teamChoices(drawClubs:string[]){
  const seen=new Set<string>(),clubs:string[]=[];
  for(const name of [...drawClubs,...extraClubs]){const key=fold(name);if(!seen.has(key)){seen.add(key);clubs.push(name);}}
  clubs.sort((a,b)=>a.localeCompare(b));
  return [{kind:'community' as const,name:'RB Tiquicia'},...clubs.map(name=>({kind:'football' as const,name}))];
}

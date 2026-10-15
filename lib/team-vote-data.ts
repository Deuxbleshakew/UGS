// Final community vote for the tournament's team places, in the agreed order (the sheet order is final:
// ties on votes are already broken). Used as the one-click starting point for the owner.
export type VotedTeam={team:string;votes:number};
export const VOTED_TEAMS:VotedTeam[]=[
  {team:'Athletic Club',votes:8},{team:'Bodø/Glimt',votes:8},{team:'Ajax',votes:7},{team:'Chelsea',votes:7},{team:'Deportivo La Coruña',votes:6},
  {team:'Galatasaray',votes:6},{team:'Newcastle United',votes:6},{team:'PSV Eindhoven',votes:6},{team:'Viktoria Plzeň',votes:6},
  {team:'AC Milan',votes:5},{team:'Benfica',votes:5},{team:'Club Brugge',votes:5},{team:'Real Sociedad',votes:5},
  {team:'Bayer Leverkusen',votes:4},{team:'Beşiktaş',votes:4},{team:'Eintracht Frankfurt',votes:4},{team:'Fiorentina',votes:4},{team:'Juventus',votes:4},
  {team:'Lyon',votes:4},{team:'Monaco',votes:4},{team:'Rayo Vallecano',votes:4},{team:'Sevilla',votes:4},{team:'Sigma Olomouc',votes:4},{team:'Young Boys',votes:4},
  {team:'Baník Ostrava',votes:3},{team:'Brøndby',votes:3},{team:'Celta Vigo',votes:3},
];
export const DEFAULT_DIRECT=5;

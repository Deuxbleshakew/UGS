export type UgsView = 'home' | 'matchroom' | 'overview' | 'guide' | 'playoffs' | 'bracket' | 'teamplayoffs' | 'squad' |
  'fixtures' | 'standings' | 'clubs' | 'statistics' | 'awards' | 'elo' |
  'friendlies' | 'history' | 'tiquicia' | 'profile' | 'admin' | 'review' | 'roster' | 'settings';

type ViewDefinition = {
  label: string;
  path: string;
  description: string;
  section: 'ugs' | 'matchroom' | 'admin';
  planned?: boolean;
};

export const ugsViews: Record<UgsView, ViewDefinition> = {
  home: {label: 'Home', path: 'home', description: 'Union Gaming Society', section: 'ugs'},
  matchroom: {label: 'Competitions', path: 'matchroom', description: 'Club Champions, matches and player rankings in one place.', section: 'matchroom'},
  overview: {label: 'Overview', path: 'matchroom/club-champions', description: 'Your selected tournament, from the draw to the final result.', section: 'matchroom'},
  guide: {label: 'Rules & Guide', path: 'matchroom/club-champions/guide', description: 'Competition guidance and published rules.', section: 'matchroom'},
  playoffs: {label: 'Qualification', path: 'matchroom/club-champions/qualification', description: 'Elo-seeded home-and-away playoffs and direct qualification.', section: 'matchroom'},
  bracket: {label: 'Knockout bracket', path: 'matchroom/club-champions/bracket', description: 'From the playoff places (9–24) to the round of 16 and the final.', section: 'matchroom'},
  teamplayoffs: {label: 'Team playoffs', path: 'matchroom/club-champions/team-playoffs', description: 'Community team vote and the simulated home-and-away playoff.', section: 'matchroom'},
  squad: {label: 'Squad builder', path: 'matchroom/club-champions/squad', description: 'Build your starting tactic and squad tactics. Opens after the draw.', section: 'matchroom'},
  fixtures: {label: 'Fixtures & results', path: 'matchroom/club-champions/fixtures', description: 'Schedule matches, submit evidence and follow official results.', section: 'matchroom'},
  standings: {label: 'League table', path: 'matchroom/club-champions/table', description: 'Standings built from finalized club results.', section: 'matchroom'},
  clubs: {label: 'Clubs & managers', path: 'matchroom/club-champions/clubs', description: 'Club assignments in your selected tournament.', section: 'matchroom'},
  statistics: {label: 'Statistics', path: 'matchroom/club-champions/statistics', description: 'Club, manager and footballer performances from finalized results.', section: 'matchroom'},
  awards: {label: 'Awards', path: 'matchroom/club-champions/awards', description: 'The honours earned in your selected tournament.', section: 'matchroom'},
  elo: {label: 'Players', path: 'matchroom/players', description: 'Human-player Elo rankings across the organizer’s tournaments.', section: 'matchroom'},
  friendlies: {label: 'Friendlies', path: 'matchroom/friendlies', description: 'Invite another player to a casual match.', section: 'matchroom'},
  history: {label: 'History', path: 'matchroom/history', description: 'A future home for published seasons and community highlights.', section: 'matchroom'},
  tiquicia: {label: 'RB Tiquicia', path: 'rb-tiquicia', description: 'Our community’s Pro Clubs team.', section: 'ugs'},
  profile: {label: 'My Profile', path: 'profile', description: 'Your followed teams and gaming details.', section: 'ugs'},
  admin: {label: 'Admin', path: 'admin', description: 'Owner tools for your tournaments and player access.', section: 'admin'},
  review: {label: 'Review queue', path: 'admin/review', description: 'Review evidence and make match reports official.', section: 'admin'},
  roster: {label: 'Players', path: 'admin/players', description: 'Add players and their photos.', section: 'admin'},
  settings: {label: 'Tournament setup', path: 'admin/setup', description: 'Manage player access, imports and tournament exports.', section: 'admin'},
};

export const competitionViews: readonly UgsView[] = ['overview', 'guide', 'playoffs', 'bracket', 'teamplayoffs', 'squad', 'fixtures', 'standings', 'clubs', 'statistics', 'awards'];
export const matchroomViews: readonly UgsView[] = ['matchroom', ...competitionViews, 'elo', 'friendlies', 'history'];
export const adminViews: readonly UgsView[] = ['admin', 'review', 'roster', 'settings'];

export function isUgsView(value: string): value is UgsView {
  return Object.hasOwn(ugsViews, value);
}

export function viewFromHash(hash: string): UgsView {
  const path = hash.replace(/^#/, '');
  return (Object.keys(ugsViews) as UgsView[]).find(key => ugsViews[key].path === path) ?? 'home';
}

export function viewHref(view: UgsView): string {
  return `#${ugsViews[view].path}`;
}

export type UgsView = 'home' | 'matchroom' | 'overview' | 'guide' | 'playoffs' |
  'fixtures' | 'standings' | 'clubs' | 'statistics' | 'awards' | 'elo' |
  'friendlies' | 'history' | 'tiquicia' | 'profile' | 'admin' | 'review' | 'settings';

type ViewDefinition = {
  label: string;
  path: string;
  description: string;
  section: 'ugs' | 'matchroom' | 'admin';
  planned?: boolean;
};

export const ugsViews: Record<UgsView, ViewDefinition> = {
  home: {label: 'Home', path: 'home', description: 'Union Gaming Society', section: 'ugs'},
  matchroom: {label: 'Matchroom', path: 'matchroom', description: 'Competitions, players and your place in the community.', section: 'matchroom'},
  overview: {label: 'Overview', path: 'matchroom/club-champions', description: 'Your selected tournament, from the draw to the final result.', section: 'matchroom'},
  guide: {label: 'Rules & Guide', path: 'matchroom/club-champions/guide', description: 'Competition guidance and published rules.', section: 'matchroom', planned: true},
  playoffs: {label: 'Qualification', path: 'matchroom/club-champions/qualification', description: 'Elo-seeded home-and-away playoffs and direct qualification.', section: 'matchroom'},
  fixtures: {label: 'Fixtures & results', path: 'matchroom/club-champions/fixtures', description: 'Schedule matches, submit evidence and follow official results.', section: 'matchroom'},
  standings: {label: 'League table', path: 'matchroom/club-champions/table', description: 'Standings built from finalized club results.', section: 'matchroom'},
  clubs: {label: 'Clubs & managers', path: 'matchroom/club-champions/clubs', description: 'Club assignments in your selected tournament.', section: 'matchroom'},
  statistics: {label: 'Statistics', path: 'matchroom/club-champions/statistics', description: 'Club, manager and footballer performances from finalized results.', section: 'matchroom'},
  awards: {label: 'Awards', path: 'matchroom/club-champions/awards', description: 'The honours earned in your selected tournament.', section: 'matchroom'},
  elo: {label: 'Players', path: 'matchroom/players', description: 'Human-player Elo rankings across the organizer’s tournaments.', section: 'matchroom'},
  friendlies: {label: 'Friendlies', path: 'matchroom/friendlies', description: 'A future home for arranging community matches.', section: 'matchroom', planned: true},
  history: {label: 'History', path: 'matchroom/history', description: 'A future home for published seasons and community highlights.', section: 'matchroom', planned: true},
  tiquicia: {label: 'RB Tiquicia', path: 'rb-tiquicia', description: 'Our community’s Pro Clubs team.', section: 'ugs'},
  profile: {label: 'My Profile', path: 'profile', description: 'Your followed teams and gaming details.', section: 'ugs'},
  admin: {label: 'Admin', path: 'admin', description: 'Owner tools for your tournaments and player access.', section: 'admin'},
  review: {label: 'Review queue', path: 'admin/review', description: 'Review evidence and make match reports official.', section: 'admin'},
  settings: {label: 'Tournament setup', path: 'admin/setup', description: 'Manage player access, imports and tournament exports.', section: 'admin'},
};

export const competitionViews: readonly UgsView[] = ['overview', 'guide', 'playoffs', 'fixtures', 'standings', 'clubs', 'statistics', 'awards'];
export const matchroomViews: readonly UgsView[] = ['matchroom', ...competitionViews, 'elo', 'friendlies', 'history'];
export const adminViews: readonly UgsView[] = ['admin', 'review', 'settings'];

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

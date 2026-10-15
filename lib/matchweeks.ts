export type MatchweekSummary={week:number;total:number;finalized:number;outstanding:number;locked:boolean};
export type Matchweeks={enabled:boolean;currentWeek:number|null;version:number;weeks:MatchweekSummary[];canAdvance:boolean};

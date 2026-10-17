-- Owner-requested team substitution. Keep the rank, vote count and tie structure.
-- Completed or partly scored playoffs remain unchanged for manual review.
CREATE TABLE team_substitution_reviews (
 playoff_id TEXT PRIMARY KEY REFERENCES team_playoffs(id),
 old_team TEXT NOT NULL, new_team TEXT NOT NULL,
 old_rank INTEGER NOT NULL, outcome TEXT NOT NULL,
 recorded_at TEXT NOT NULL
);
INSERT INTO team_substitution_reviews
SELECT p.id,'Baník Ostrava','FC Porto',e.rank,
 CASE WHEN p.status='ready'
 AND NOT EXISTS(SELECT 1 FROM team_playoff_entries x WHERE x.playoff_id=p.id AND lower(x.team)='fc porto')
 AND NOT EXISTS(SELECT 1 FROM team_playoff_ties t WHERE t.playoff_id=p.id AND (t.l1_low IS NOT NULL OR t.l1_high IS NOT NULL OR t.l2_low IS NOT NULL OR t.l2_high IS NOT NULL OR t.pens_low IS NOT NULL OR t.pens_high IS NOT NULL OR t.winner_rank IS NOT NULL))
 THEN 'applied' ELSE 'requires-review' END,
 strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM team_playoffs p JOIN tournaments c ON c.id=p.tournament_id
JOIN team_playoff_entries e ON e.playoff_id=p.id AND lower(e.team)='baník ostrava'
WHERE p.status<>'cancelled' AND json_extract(c.config,'$.tournamentId')='ucl-fantasy-2026';
UPDATE team_playoff_entries SET team='FC Porto'
WHERE (playoff_id,rank) IN(SELECT playoff_id,old_rank FROM team_substitution_reviews WHERE outcome='applied');
UPDATE team_playoffs SET version=version+1 WHERE id IN(SELECT playoff_id FROM team_substitution_reviews WHERE outcome='applied');
INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after")
SELECT lower(hex(randomblob(16))),p.tournament_id,p.created_by,'Owner-requested substitution',r.recorded_at,
 'team-substitution',r.outcome,json_object('team',r.old_team,'rank',r.old_rank),json_object('team',CASE WHEN r.outcome='applied' THEN r.new_team ELSE r.old_team END,'rank',r.old_rank)
FROM team_substitution_reviews r JOIN team_playoffs p ON p.id=r.playoff_id;

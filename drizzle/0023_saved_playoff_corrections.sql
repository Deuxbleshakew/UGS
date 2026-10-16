-- Correct the owner's existing, unplayed qualification draw without recreating it.
CREATE TABLE saved_playoff_corrections (
 playoff_id TEXT PRIMARY KEY REFERENCES team_playoffs(id),
 previous_entries TEXT NOT NULL, previous_ties TEXT NOT NULL,
 outcome TEXT NOT NULL, recorded_at TEXT NOT NULL
);
INSERT INTO saved_playoff_corrections
SELECT p.id,
 (SELECT json_group_array(json_object('rank',e.rank,'team',e.team,'votes',e.votes,'strength',e.strength)) FROM team_playoff_entries e WHERE e.playoff_id=p.id),
 (SELECT json_group_array(json_object('id',t.id,'position',t.position,'high_rank',t.high_rank,'low_rank',t.low_rank,'l1_low',t.l1_low,'l1_high',t.l1_high,'l2_low',t.l2_low,'l2_high',t.l2_high,'winner_rank',t.winner_rank)) FROM team_playoff_ties t WHERE t.playoff_id=p.id),
 CASE WHEN p.status='ready' AND NOT EXISTS(SELECT 1 FROM team_playoff_ties t WHERE t.playoff_id=p.id AND (t.l1_low IS NOT NULL OR t.l1_high IS NOT NULL OR t.l2_low IS NOT NULL OR t.l2_high IS NOT NULL OR t.pens_low IS NOT NULL OR t.pens_high IS NOT NULL OR t.winner_rank IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM team_playoff_entries e WHERE e.playoff_id=p.id AND lower(e.team) IN ('tottenham hotspur','marseille','sparta praha'))
 THEN 'applied' ELSE 'requires-review' END,
 strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM team_playoffs p JOIN tournaments c ON c.id=p.tournament_id
WHERE p.status<>'cancelled' AND json_extract(c.config,'$.tournamentId')='ucl-fantasy-2026'
AND EXISTS(SELECT 1 FROM team_playoff_entries e WHERE e.playoff_id=p.id AND lower(e.team) IN ('lyon','sigma olomouc','rayo vallecano'));
UPDATE team_playoff_entries SET team=CASE lower(team)
 WHEN 'lyon' THEN 'Tottenham Hotspur' WHEN 'sigma olomouc' THEN 'Marseille'
 WHEN 'rayo vallecano' THEN 'Sparta Praha' ELSE team END
WHERE playoff_id IN(SELECT playoff_id FROM saved_playoff_corrections WHERE outcome='applied');
-- Swap the opponents of the two existing ties only when all four names match.
-- This preserves every other tie, seed and home-leg rule.
CREATE TEMP TABLE corrected_pairings AS
SELECT a.id AS first_id,b.id AS second_id,a.high_rank AS first_high,b.high_rank AS second_high,a.low_rank AS first_low,b.low_rank AS second_low
FROM team_playoff_ties a
JOIN team_playoff_ties b ON b.playoff_id=a.playoff_id
JOIN team_playoff_entries ah ON ah.playoff_id=a.playoff_id AND ah.rank=a.high_rank
JOIN team_playoff_entries al ON al.playoff_id=a.playoff_id AND al.rank=a.low_rank
JOIN team_playoff_entries bh ON bh.playoff_id=b.playoff_id AND bh.rank=b.high_rank
JOIN team_playoff_entries bl ON bl.playoff_id=b.playoff_id AND bl.rank=b.low_rank
WHERE a.playoff_id IN(SELECT playoff_id FROM saved_playoff_corrections WHERE outcome='applied')
AND ah.team='Viktoria Plzeň' AND al.team='Young Boys' AND bh.team='Real Sociedad' AND bl.team='Monaco';
UPDATE team_playoff_ties SET
 high_rank=min(high_rank,(SELECT second_low FROM corrected_pairings WHERE first_id=team_playoff_ties.id)),
 low_rank=max(high_rank,(SELECT second_low FROM corrected_pairings WHERE first_id=team_playoff_ties.id))
WHERE id IN(SELECT first_id FROM corrected_pairings);
UPDATE team_playoff_ties SET
 high_rank=min(high_rank,(SELECT first_low FROM corrected_pairings WHERE second_id=team_playoff_ties.id)),
 low_rank=max(high_rank,(SELECT first_low FROM corrected_pairings WHERE second_id=team_playoff_ties.id))
WHERE id IN(SELECT second_id FROM corrected_pairings);
DROP TABLE corrected_pairings;
UPDATE team_playoffs SET version=version+1 WHERE id IN(SELECT playoff_id FROM saved_playoff_corrections WHERE outcome='applied');
INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after")
SELECT lower(hex(randomblob(16))),p.tournament_id,p.created_by,'Owner-approved playoff correction',r.recorded_at,
 'saved-playoff-correction',r.outcome,json_object('entries',json(r.previous_entries),'ties',json(r.previous_ties)),
 json_object('outcome',r.outcome)
FROM saved_playoff_corrections r JOIN team_playoffs p ON p.id=r.playoff_id;

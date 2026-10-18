-- Repair a draw created after the one-time 0026 pairing correction.
-- Only the four exact, unplayed original ties may be changed.
CREATE TABLE playoff_pairing_retry_reviews (
  playoff_id TEXT PRIMARY KEY REFERENCES team_playoffs(id),
  previous_ties TEXT NOT NULL,
  outcome TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TEMP TABLE requested_current_pairings AS
SELECT p.id AS playoff_id, wanted.position,
       min(first.rank,second.rank) AS high_rank,
       max(first.rank,second.rank) AS low_rank
FROM team_playoffs p
JOIN (
  SELECT 3 AS position,'FC Porto' AS first_team,'Monaco' AS second_team
  UNION ALL SELECT 4,'Marseille','Young Boys'
  UNION ALL SELECT 5,'AC Milan','Viktoria Plzeň'
  UNION ALL SELECT 8,'Real Sociedad','PSV Eindhoven'
) wanted
JOIN team_playoff_entries first ON first.playoff_id=p.id AND first.team=wanted.first_team
JOIN team_playoff_entries second ON second.playoff_id=p.id AND second.team=wanted.second_team;

INSERT INTO playoff_pairing_retry_reviews
SELECT p.id,
  (SELECT json_group_array(json_object('position',t.position,'high_rank',t.high_rank,
    'low_rank',t.low_rank,'l1_low',t.l1_low,'l1_high',t.l1_high,
    'l2_low',t.l2_low,'l2_high',t.l2_high,'winner_rank',t.winner_rank))
   FROM team_playoff_ties t WHERE t.playoff_id=p.id AND t.position IN (3,4,5,8)),
  CASE
    WHEN (SELECT count(*) FROM requested_current_pairings r WHERE r.playoff_id=p.id)=4
      AND (SELECT count(*) FROM requested_current_pairings r
        JOIN team_playoff_ties t ON t.playoff_id=r.playoff_id AND t.position=r.position
          AND t.high_rank=r.high_rank AND t.low_rank=r.low_rank
        WHERE r.playoff_id=p.id)=4 THEN 'already-correct'
    WHEN p.status='ready'
      AND (SELECT count(*) FROM requested_current_pairings r WHERE r.playoff_id=p.id)=4
      AND (SELECT count(*) FROM team_playoff_ties t
        JOIN team_playoff_entries high ON high.playoff_id=t.playoff_id AND high.rank=t.high_rank
        JOIN team_playoff_entries low ON low.playoff_id=t.playoff_id AND low.rank=t.low_rank
        WHERE t.playoff_id=p.id AND (
          (t.position=3 AND high.team='PSV Eindhoven' AND low.team='FC Porto') OR
          (t.position=4 AND high.team='Viktoria Plzeň' AND low.team='Young Boys') OR
          (t.position=5 AND high.team='AC Milan' AND low.team='Marseille') OR
          (t.position=8 AND high.team='Real Sociedad' AND low.team='Monaco')
        ))=4
      AND NOT EXISTS (SELECT 1 FROM team_playoff_ties t WHERE t.playoff_id=p.id
        AND t.position IN (3,4,5,8) AND
        (t.l1_low IS NOT NULL OR t.l1_high IS NOT NULL OR
         t.l2_low IS NOT NULL OR t.l2_high IS NOT NULL OR
         t.pens_low IS NOT NULL OR t.pens_high IS NOT NULL OR
         t.winner_rank IS NOT NULL)) THEN 'applied'
    ELSE 'requires-review'
  END,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM team_playoffs p JOIN tournaments c ON c.id=p.tournament_id
WHERE p.status<>'cancelled'
  AND json_extract(c.config,'$.tournamentId')='ucl-fantasy-2026'
  AND EXISTS (SELECT 1 FROM team_playoff_entries e WHERE e.playoff_id=p.id AND e.team='FC Porto');

UPDATE team_playoff_ties
SET high_rank=(SELECT r.high_rank FROM requested_current_pairings r
    WHERE r.playoff_id=team_playoff_ties.playoff_id AND r.position=team_playoff_ties.position),
    low_rank=(SELECT r.low_rank FROM requested_current_pairings r
    WHERE r.playoff_id=team_playoff_ties.playoff_id AND r.position=team_playoff_ties.position)
WHERE EXISTS (SELECT 1 FROM requested_current_pairings r
  JOIN playoff_pairing_retry_reviews v ON v.playoff_id=r.playoff_id AND v.outcome='applied'
  WHERE r.playoff_id=team_playoff_ties.playoff_id AND r.position=team_playoff_ties.position);

UPDATE team_playoffs SET version=version+1
WHERE id IN (SELECT playoff_id FROM playoff_pairing_retry_reviews WHERE outcome='applied');

INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after")
SELECT lower(hex(randomblob(16))),p.tournament_id,p.created_by,
  'Owner-requested playoff pairings',r.recorded_at,'team-playoff-repairing',
  'Applied the four requested pairings to an unplayed draw created after the first correction.',
  json_object('ties',json(r.previous_ties)),
  json_object('outcome',r.outcome)
FROM playoff_pairing_retry_reviews r JOIN team_playoffs p ON p.id=r.playoff_id
WHERE r.outcome='applied';

DROP TABLE requested_current_pairings;

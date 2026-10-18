-- Re-pair only the owner's unplayed, saved team playoff. Rankings and votes stay put.
CREATE TABLE playoff_pairing_reviews (
  playoff_id TEXT PRIMARY KEY REFERENCES team_playoffs(id),
  previous_ties TEXT NOT NULL,
  requested_pairings TEXT NOT NULL,
  outcome TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TEMP TABLE requested_playoff_pairings AS
SELECT p.id AS playoff_id, pair.position,
       min(first.rank, second.rank) AS high_rank,
       max(first.rank, second.rank) AS low_rank
FROM team_playoffs p
JOIN tournaments c ON c.id=p.tournament_id
JOIN (
  SELECT 3 AS position, 'FC Porto' AS first_team, 'Monaco' AS second_team
  UNION ALL SELECT 4, 'Marseille', 'Young Boys'
  UNION ALL SELECT 5, 'AC Milan', 'Viktoria Plzeň'
  UNION ALL SELECT 8, 'Real Sociedad', 'PSV Eindhoven'
) pair
JOIN team_playoff_entries first ON first.playoff_id=p.id AND first.team=pair.first_team
JOIN team_playoff_entries second ON second.playoff_id=p.id AND second.team=pair.second_team
JOIN team_playoff_ties existing_tie ON existing_tie.playoff_id=p.id
  AND existing_tie.position=pair.position
WHERE p.status<>'cancelled'
  AND json_extract(c.config,'$.tournamentId')='ucl-fantasy-2026';

INSERT INTO playoff_pairing_reviews
SELECT p.id,
  (SELECT json_group_array(json_object('id',t.id,'position',t.position,
    'high_rank',t.high_rank,'low_rank',t.low_rank,
    'l1_low',t.l1_low,'l1_high',t.l1_high,'l2_low',t.l2_low,'l2_high',t.l2_high,
    'pens_low',t.pens_low,'pens_high',t.pens_high,'winner_rank',t.winner_rank))
   FROM team_playoff_ties t WHERE t.playoff_id=p.id),
  json_array(json_array('Marseille','Young Boys'),
    json_array('AC Milan','Viktoria Plzeň'),
    json_array('FC Porto','Monaco'),
    json_array('Real Sociedad','PSV Eindhoven')),
  CASE WHEN p.status='ready'
    AND (SELECT count(*) FROM requested_playoff_pairings r WHERE r.playoff_id=p.id)=4
    AND (SELECT count(DISTINCT position) FROM requested_playoff_pairings r WHERE r.playoff_id=p.id)=4
    AND (SELECT count(*) FROM team_playoff_entries e
      JOIN team_playoff_ties t ON t.playoff_id=e.playoff_id
        AND e.rank IN (t.high_rank,t.low_rank)
      WHERE e.playoff_id=p.id
        AND t.position IN (SELECT position FROM requested_playoff_pairings r WHERE r.playoff_id=p.id)
        AND e.team IN ('Marseille','Young Boys','AC Milan','Viktoria Plzeň',
          'FC Porto','Monaco','Real Sociedad','PSV Eindhoven'))=8
    AND NOT EXISTS (SELECT 1 FROM team_playoff_ties t WHERE t.playoff_id=p.id
      AND (t.l1_low IS NOT NULL OR t.l1_high IS NOT NULL
        OR t.l2_low IS NOT NULL OR t.l2_high IS NOT NULL
        OR t.pens_low IS NOT NULL OR t.pens_high IS NOT NULL
        OR t.winner_rank IS NOT NULL))
    THEN 'applied' ELSE 'requires-review' END,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM team_playoffs p JOIN tournaments c ON c.id=p.tournament_id
WHERE p.status<>'cancelled'
  AND json_extract(c.config,'$.tournamentId')='ucl-fantasy-2026'
  AND EXISTS (SELECT 1 FROM team_playoff_entries e WHERE e.playoff_id=p.id
    AND e.team IN ('Marseille','AC Milan','FC Porto','Real Sociedad'));

UPDATE team_playoff_ties
SET high_rank=(SELECT r.high_rank FROM requested_playoff_pairings r
    WHERE r.playoff_id=team_playoff_ties.playoff_id AND r.position=team_playoff_ties.position),
    low_rank=(SELECT r.low_rank FROM requested_playoff_pairings r
    WHERE r.playoff_id=team_playoff_ties.playoff_id AND r.position=team_playoff_ties.position)
WHERE EXISTS (SELECT 1 FROM requested_playoff_pairings r
  JOIN playoff_pairing_reviews v ON v.playoff_id=r.playoff_id AND v.outcome='applied'
  WHERE r.playoff_id=team_playoff_ties.playoff_id
    AND r.position=team_playoff_ties.position);

UPDATE team_playoffs SET version=version+1
WHERE id IN (SELECT playoff_id FROM playoff_pairing_reviews WHERE outcome='applied');

INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after")
SELECT lower(hex(randomblob(16))),p.tournament_id,p.created_by,
  'Owner-requested playoff pairings',r.recorded_at,
  'team-playoff-repairing',r.outcome,
  json_object('ties',json(r.previous_ties)),
  json_object('requested',json(r.requested_pairings),'outcome',r.outcome)
FROM playoff_pairing_reviews r JOIN team_playoffs p ON p.id=r.playoff_id;

DROP TABLE requested_playoff_pairings;

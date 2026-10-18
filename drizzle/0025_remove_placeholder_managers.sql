-- Remove only the eight unclaimed seed slots. Keep any slot that has been
-- assigned a club or member, and record those exceptions for review.
CREATE TABLE placeholder_manager_cleanup (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  manager_id TEXT NOT NULL,
  player_id TEXT,
  outcome TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (tournament_id, manager_id)
);

INSERT INTO placeholder_manager_cleanup
SELECT t.id,
  json_extract(m.value, '$.id'),
  (SELECT l.player_id FROM player_links l
   WHERE l.tournament_id=t.id AND l.manager_id=json_extract(m.value, '$.id')),
  CASE WHEN EXISTS (
    SELECT 1 FROM json_each(t.config, '$.clubs') c
    WHERE json_extract(c.value, '$.manager')=json_extract(m.value, '$.id')
  ) OR EXISTS (
    SELECT 1 FROM members b
    WHERE b.tournament_id=t.id AND b.manager_id=json_extract(m.value, '$.id')
  ) THEN 'requires-review' ELSE 'removed' END,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM tournaments t, json_each(t.config, '$.managers') m
WHERE json_extract(t.config,'$.tournamentId')='ucl-fantasy-2026'
  AND json_extract(m.value, '$.id') IN (
    'manager-5','manager-6','manager-7','manager-8',
    'manager-9','manager-10','manager-11','manager-12'
  )
  AND json_extract(m.value, '$.name') =
    'Manager ' || substr(json_extract(m.value, '$.id'), length('manager-') + 1);

UPDATE tournaments
SET config=json_set(config, '$.managers', json((
  SELECT json_group_array(json(m.value))
  FROM json_each(tournaments.config, '$.managers') m
  WHERE NOT EXISTS (
    SELECT 1 FROM placeholder_manager_cleanup c
    WHERE c.tournament_id=tournaments.id
      AND c.manager_id=json_extract(m.value, '$.id') AND c.outcome='removed'
  )
))), revision=revision+1
WHERE EXISTS (
  SELECT 1 FROM placeholder_manager_cleanup c
  WHERE c.tournament_id=tournaments.id AND c.outcome='removed'
);

-- Generated player profiles can be deleted only when no account, result,
-- playoff, invitation, or photo refers to them. Historical data is preserved.
CREATE TEMP TABLE removable_placeholder_players AS
SELECT DISTINCT c.player_id AS id
FROM placeholder_manager_cleanup c
WHERE c.outcome='removed' AND c.player_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_links l
    WHERE l.player_id=c.player_id AND NOT EXISTS (
      SELECT 1 FROM placeholder_manager_cleanup x
      WHERE x.tournament_id=l.tournament_id AND x.manager_id=l.manager_id
        AND x.outcome='removed'
    )
  )
  AND NOT EXISTS (SELECT 1 FROM members m WHERE m.player_id=c.player_id)
  AND NOT EXISTS (SELECT 1 FROM account_usernames u WHERE u.player_id=c.player_id)
  AND NOT EXISTS (SELECT 1 FROM fixtures f WHERE f.home_player_id=c.player_id OR f.away_player_id=c.player_id)
  AND NOT EXISTS (SELECT 1 FROM playoff_ties p WHERE p.player_a=c.player_id OR p.player_b=c.player_id)
  AND NOT EXISTS (SELECT 1 FROM player_photos p WHERE p.player_id=c.player_id)
  AND NOT EXISTS (
    SELECT 1 FROM playoffs p
    WHERE EXISTS (SELECT 1 FROM json_each(p.entrants) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=c.player_id)
       OR EXISTS (SELECT 1 FROM json_each(p.automatic_qualifiers) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=c.player_id)
       OR EXISTS (SELECT 1 FROM json_each(p.qualified) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=c.player_id)
  );

DELETE FROM player_links WHERE EXISTS (
  SELECT 1 FROM placeholder_manager_cleanup c
  WHERE c.tournament_id=player_links.tournament_id
    AND c.manager_id=player_links.manager_id AND c.outcome='removed'
);
DELETE FROM community_players WHERE id IN (SELECT id FROM removable_placeholder_players);
DROP TABLE removable_placeholder_players;

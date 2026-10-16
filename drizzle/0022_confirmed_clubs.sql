-- Owner-approved roster correction. Preserve original configs and all match data.
-- Scope to this draw only; played/created club fixtures and locked seasons require review.
CREATE TABLE club_roster_corrections (
 tournament_id TEXT PRIMARY KEY REFERENCES tournaments(id),
 previous_config TEXT NOT NULL,
 corrected_config TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('applied','requires-review')),
 recorded_at TEXT NOT NULL
);
INSERT INTO club_roster_corrections
SELECT t.id,t.config,
 json_set(t.config,'$.clubs',json('[{"id":"arsenal","name":"Arsenal","country":"ENG","shortName":"ARS","pot":"pending"},{"id":"aston-villa","name":"Aston Villa","country":"ENG","shortName":"AST","pot":"pending"},{"id":"liverpool","name":"Liverpool","country":"ENG","shortName":"LIV","pot":"pending"},{"id":"man-city","name":"Manchester City","country":"ENG","shortName":"MAN","pot":"pending"},{"id":"manchester-united","name":"Manchester United","country":"ENG","shortName":"MAN","pot":"pending"},{"id":"atletico-madrid","name":"Atlético Madrid","country":"ESP","shortName":"ATL","pot":"pending"},{"id":"barcelona","name":"Barcelona","country":"ESP","shortName":"BAR","pot":"pending"},{"id":"real-betis","name":"Real Betis","country":"ESP","shortName":"REA","pot":"pending"},{"id":"real-madrid","name":"Real Madrid","country":"ESP","shortName":"REA","pot":"pending"},{"id":"villarreal","name":"Villarreal","country":"ESP","shortName":"VIL","pot":"pending"},{"id":"bayern-munich","name":"Bayern Munich","country":"GER","shortName":"BAY","pot":"pending"},{"id":"dortmund","name":"Borussia Dortmund","country":"GER","shortName":"DOR","pot":"pending"},{"id":"leipzig","name":"RB Leipzig","country":"GER","shortName":"LEI","pot":"pending"},{"id":"como","name":"Como","country":"ITA","shortName":"COM","pot":"pending"},{"id":"inter","name":"Inter Milan","country":"ITA","shortName":"INT","pot":"pending"},{"id":"napoli","name":"Napoli","country":"ITA","shortName":"NAP","pot":"pending"},{"id":"roma","name":"Roma","country":"ITA","shortName":"ROM","pot":"pending"},{"id":"lens","name":"Lens","country":"FRA","shortName":"LEN","pot":"pending"},{"id":"lille","name":"Lille","country":"FRA","shortName":"LIL","pot":"pending"},{"id":"psg","name":"Paris Saint-Germain","country":"FRA","shortName":"PSG","pot":"pending"}]'),'$.pots',json('[{"id":"pending","name":"Awaiting pot vote"}]')),
 CASE WHEN t.locked_at IS NOT NULL OR EXISTS(SELECT 1 FROM fixtures f WHERE f.tournament_id=t.id AND f.kind='club')
 THEN 'requires-review' ELSE 'applied' END,
 strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM tournaments t WHERE json_extract(t.config,'$.tournamentId')='ucl-fantasy-2026';
INSERT INTO audit(id,tournament_id,actor_id,actor_name,at,action,reason,"before","after")
SELECT lower(hex(randomblob(16))),r.tournament_id,t.owner_id,'Owner-approved roster correction',r.recorded_at,
 'confirmed-clubs-correction',
 CASE r.outcome WHEN 'applied' THEN '20 confirmed clubs; 5 direct qualification places and 11 playoff winner places remain. Pots await voting.'
 ELSE 'Roster correction requires review: existing club fixtures or locked tournament preserved.' END,
 r.previous_config,CASE r.outcome WHEN 'applied' THEN r.corrected_config ELSE r.previous_config END
FROM club_roster_corrections r JOIN tournaments t ON t.id=r.tournament_id;
UPDATE tournaments SET config=(SELECT corrected_config FROM club_roster_corrections r WHERE r.tournament_id=tournaments.id),revision=revision+1
WHERE id IN(SELECT tournament_id FROM club_roster_corrections WHERE outcome='applied');

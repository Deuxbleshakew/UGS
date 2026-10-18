-- The organizer account starts as "just following" instead of counting as a player.
-- Runs once; the admin can switch themselves back on in Players admin.
UPDATE community_players SET in_tournament=0
WHERE in_tournament=1 AND id IN (
  SELECT m.player_id FROM members m JOIN tournaments t ON t.id=m.tournament_id
  WHERE m.user_id IS NOT NULL AND m.user_id=t.owner_id AND m.player_id IS NOT NULL
);

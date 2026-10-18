import type {DatabaseSync} from 'node:sqlite';

export class PlayerDeletionBlocked extends Error {}

type Player={id:string;name:string};
type Link={tournament_id:string;manager_id:string;owner_id:string;locked_at:string|null;config:string};

/** Delete an unused player and any empty manager slots that would recreate it. Caller owns the transaction. */
export function deletePlayerRecord(db:DatabaseSync,ownerId:string,playerId:string){
  const player=db.prepare('SELECT id,name FROM community_players WHERE id=? AND owner_id=?').get(playerId,ownerId) as Player|undefined;
  if(!player)throw new PlayerDeletionBlocked('Player not found. Refresh the list.');
  const used=(sql:string,...args:string[])=>!!db.prepare(sql).get(...args);
  if(used('SELECT 1 FROM account_usernames WHERE player_id=?',playerId))
    throw new PlayerDeletionBlocked('This player has a username or login. Remove their user access before deleting the player.');
  if(used('SELECT 1 FROM members WHERE player_id=?',playerId))
    throw new PlayerDeletionBlocked('This player is assigned to a tournament member. Remove that assignment first.');
  if(used("SELECT 1 FROM fixtures WHERE home_player_id=? OR away_player_id=? OR (kind='player' AND (home=? OR away=?))",playerId,playerId,playerId,playerId))
    throw new PlayerDeletionBlocked('This player appears in match history. Their results must be kept.');
  if(used('SELECT 1 FROM playoff_ties WHERE player_a=? OR player_b=?',playerId,playerId))
    throw new PlayerDeletionBlocked('This player appears in a playoff tie. Their history must be kept.');
  if(used(`SELECT 1 FROM playoffs p WHERE
      EXISTS(SELECT 1 FROM json_each(p.entrants) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=?)
      OR EXISTS(SELECT 1 FROM json_each(p.automatic_qualifiers) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=?)
      OR EXISTS(SELECT 1 FROM json_each(p.qualified) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.id') ELSE e.value END=?)`,playerId,playerId,playerId))
    throw new PlayerDeletionBlocked('This player appears in playoff history. Their record must be kept.');

  const links=db.prepare(`SELECT l.tournament_id,l.manager_id,t.owner_id,t.locked_at,t.config
    FROM player_links l JOIN tournaments t ON t.id=l.tournament_id WHERE l.player_id=?`).all(playerId) as Link[];
  const updated=new Map<string,{config:Record<string,unknown>;removed:Set<string>}>();
  for(const link of links){
    if(link.owner_id!==ownerId)throw new PlayerDeletionBlocked('This player is linked outside your tournaments. Contact support before deleting.');
    if(link.locked_at)throw new PlayerDeletionBlocked('This player has a manager slot in a locked tournament. Unlock it before deleting.');
    if(used('SELECT 1 FROM members WHERE tournament_id=? AND manager_id=?',link.tournament_id,link.manager_id))
      throw new PlayerDeletionBlocked('This manager slot belongs to a member. Remove that assignment first.');
    let entry=updated.get(link.tournament_id);
    if(!entry){entry={config:JSON.parse(link.config) as Record<string,unknown>,removed:new Set()};updated.set(link.tournament_id,entry);}
    const clubs=entry.config.clubs as {manager?:string}[];
    if(clubs.some(club=>club.manager===link.manager_id))
      throw new PlayerDeletionBlocked('This manager has an assigned club. Unassign the club before deleting the player.');
    entry.removed.add(link.manager_id);
  }
  for(const [tid,entry] of updated){
    const managers=entry.config.managers as {id:string}[];
    const remaining=managers.filter(manager=>!entry.removed.has(manager.id));
    if(!remaining.length)throw new PlayerDeletionBlocked('A tournament must keep at least one manager slot.');
    if(remaining.length!==managers.length){
      db.prepare('UPDATE tournaments SET config=?,revision=revision+1 WHERE id=?')
        .run(JSON.stringify({...entry.config,managers:remaining}),tid);
    }
  }
  db.prepare('DELETE FROM player_links WHERE player_id=?').run(playerId);
  db.prepare('DELETE FROM player_photos WHERE player_id=?').run(playerId);
  db.prepare('DELETE FROM community_players WHERE id=? AND owner_id=?').run(playerId,ownerId);
  return {player,removedManagerSlots:links.map(link=>({tournamentId:link.tournament_id,managerId:link.manager_id}))};
}

import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {database} from '@/scripts/local-store.mjs';
import {proofStore} from './storage';

export class TournamentDeletionError extends Error {
  constructor(message:string,public status=409){super(message);}
}

type Tournament={id:string;name:string;owner_id:string};
type Count={count:number};

/** Remove one owner's tournament and its dependent history, without touching shared players or accounts. */
export async function deleteTournament(ownerId:string,tournamentId:string,confirmedName:string){
  const db=database() as DatabaseSync;
  db.exec('BEGIN IMMEDIATE');
  let proofKeys:string[]=[];
  let remainingId:string|null=null;
  try{
    const t=db.prepare('SELECT id,name,owner_id FROM tournaments WHERE id=?').get(tournamentId) as Tournament|undefined;
    if(!t)throw new TournamentDeletionError('Tournament not found. Refresh the list.',404);
    if(t.owner_id!==ownerId)throw new TournamentDeletionError('Only the owner can delete this tournament.',403);
    if(t.name!==confirmedName)throw new TournamentDeletionError('The tournament name did not match. Nothing was deleted.');
    const count=(sql:string)=>Number((db.prepare(sql).get(tournamentId) as Count).count);
    const fixtureCount=count('SELECT count(*) AS count FROM fixtures WHERE tournament_id=?');
    const playerPlayoffCount=count('SELECT count(*) AS count FROM playoffs WHERE tournament_id=?');
    const teamPlayoffCount=count('SELECT count(*) AS count FROM team_playoffs WHERE tournament_id=?');
    proofKeys=(db.prepare('SELECT key FROM proofs WHERE tournament_id=?').all(tournamentId) as {key:string}[]).map(p=>p.key);
    db.prepare('INSERT INTO tournament_deletion_context(tournament_id) VALUES(?)').run(tournamentId);

    // Child records come first. Foreign keys remain enabled throughout the transaction.
    for(const table of ['schedule_events','schedule_proposals','schedule_windows','schedule_settings','proofs','audit','matchweek_control','fixtures'])
      db.prepare(`DELETE FROM ${table} WHERE tournament_id=?`).run(tournamentId);
    db.prepare('DELETE FROM playoff_ties WHERE playoff_id IN (SELECT id FROM playoffs WHERE tournament_id=?)').run(tournamentId);
    db.prepare('DELETE FROM playoffs WHERE tournament_id=?').run(tournamentId);
    for(const table of ['saved_playoff_corrections','team_substitution_reviews','playoff_pairing_reviews','playoff_pairing_retry_reviews','team_playoff_entries','team_playoff_ties'])
      db.prepare(`DELETE FROM ${table} WHERE playoff_id IN (SELECT id FROM team_playoffs WHERE tournament_id=?)`).run(tournamentId);
    db.prepare('DELETE FROM team_playoffs WHERE tournament_id=?').run(tournamentId);
    for(const table of ['squads','squad_access','club_stars','club_roster_corrections','placeholder_manager_cleanup','player_links','invitations','members'])
      db.prepare(`DELETE FROM ${table} WHERE tournament_id=?`).run(tournamentId);
    db.prepare('DELETE FROM tournaments WHERE id=? AND owner_id=?').run(tournamentId,ownerId);
    db.prepare('DELETE FROM tournament_deletion_context WHERE tournament_id=?').run(tournamentId);
    db.prepare('INSERT INTO tournament_deletion_audit(id,owner_id,tournament_id,tournament_name,deleted_at,fixture_count,player_playoff_count,team_playoff_count) VALUES(?,?,?,?,?,?,?,?)')
      .run(randomUUID(),ownerId,tournamentId,t.name,new Date().toISOString(),fixtureCount,playerPlayoffCount,teamPlayoffCount);
    const problems=db.prepare('PRAGMA foreign_key_check').all();
    if(problems.length)throw new Error('Deleting the tournament would leave broken references.');
    remainingId=(db.prepare('SELECT id FROM tournaments WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 1').get(ownerId) as {id:string}|undefined)?.id??null;
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}

  // Proofs are stored on disk; remove their files only after the database commit.
  for(const key of proofKeys){try{await proofStore.delete(key);}catch(error){console.error('Could not remove a deleted tournament proof file',error);}}
  return {ok:true,remainingId};
}

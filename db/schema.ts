import { sqliteTable, text, integer, uniqueIndex, index, primaryKey, check } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';

export const accounts=sqliteTable('accounts',{
  id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  passwordHash:text('password_hash').notNull(),owner:integer('owner').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('account_email').on(t.email),uniqueIndex('account_single_owner').on(t.owner).where(sql`${t.owner} = 1`)]);
export const sessions=sqliteTable('sessions',{
  tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),expiresAt:integer('expires_at').notNull(),
},t=>[index('session_account').on(t.accountId)]);
export const invitations=sqliteTable('invitations',{
  tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  tournamentId:text('tournament_id').notNull().references(()=>tournaments.id),expiresAt:integer('expires_at').notNull(),
},t=>[index('invitation_email').on(t.email)]);
export const authLimits=sqliteTable('auth_limits',{
  key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull(),
});

export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(), name: text("name").notNull(), ownerId: text("owner_id").notNull(),
  config: text("config").notNull(), createdAt: text("created_at").notNull(),
  awards: text("awards"), lockedAt: text("locked_at"), revision: integer("revision").notNull().default(0), mutation: text("mutation"),
});
export const members = sqliteTable("members", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(()=>tournaments.id),
  userId: text("user_id"), email: text("email").notNull(), name: text("name").notNull(),
  role: text("role").notNull(), managerId: text("manager_id"),
  playerId:text('player_id').references(()=>communityPlayers.id),
}, t=>[uniqueIndex("member_email").on(t.tournamentId,t.email),uniqueIndex("member_manager").on(t.tournamentId,t.managerId),uniqueIndex('member_player').on(t.tournamentId,t.playerId), index("member_user").on(t.userId)]);
export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(()=>tournaments.id),
  home: text("home").notNull(), away: text("away").notNull(), stage: text("stage").notNull(),
  matchday: integer("matchday").notNull(), scheduled: text("scheduled"),
  status: text("status").notNull().default("scheduled"), report: text("report"),
  submittedBy: text("submitted_by"), submittedManager: text("submitted_manager"),
  submittedAt: text("submitted_at"), finalizedAt: text("finalized_at"), note: text("note"),
  version: integer("version").notNull().default(0), mutation: text("mutation"),
  kind:text('kind').notNull().default('club'),
  homePlayerId:text('home_player_id').references(()=>communityPlayers.id),awayPlayerId:text('away_player_id').references(()=>communityPlayers.id),
  tieId:text('tie_id').references(()=>playoffTies.id),leg:integer('leg'),playoffRound:integer('playoff_round'),
}, t=>[index("fixture_tournament").on(t.tournamentId),uniqueIndex("fixture_pair").on(t.tournamentId,t.stage,t.matchday,t.home,t.away).where(sql`${t.kind} = 'club'`),uniqueIndex('fixture_tie_leg').on(t.tieId,t.leg),index('fixture_rating').on(t.status,t.homePlayerId,t.awayPlayerId)]);
export const proofs = sqliteTable("proofs", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(()=>tournaments.id),
  fixtureId: text("fixture_id").notNull().references(()=>fixtures.id),
  uploader: text("uploader").notNull(), uploadedAt: text("uploaded_at").notNull(),
  category: text("category").notNull(), name: text("name").notNull(), mime: text("mime").notNull(),
  size: integer("size").notNull(), key: text("key").notNull(),
}, t=>[index("proof_fixture").on(t.fixtureId)]);
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(()=>tournaments.id),
  fixtureId: text("fixture_id"), actorId: text("actor_id").notNull(), actorName: text("actor_name").notNull(),
  at: text("at").notNull(), action: text("action").notNull(), reason: text("reason").notNull(),
  before: text("before"), after: text("after"),
}, t=>[index("audit_tournament").on(t.tournamentId)]);

export const communityPlayers=sqliteTable('community_players',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>accounts.id),name:text('name').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('community_player_owner').on(t.ownerId)]);
export const playerLinks=sqliteTable('player_links',{
  tournamentId:text('tournament_id').notNull().references(()=>tournaments.id),managerId:text('manager_id').notNull(),playerId:text('player_id').notNull().references(()=>communityPlayers.id),
},t=>[primaryKey({columns:[t.tournamentId,t.managerId]})]);
export const playoffs=sqliteTable('playoffs',{
  id:text('id').primaryKey(),tournamentId:text('tournament_id').notNull().references(()=>tournaments.id),name:text('name').notNull(),target:integer('target').notNull(),
  eloMode:text('elo_mode').notNull(),drawSeed:text('draw_seed').notNull(),entrants:text('entrants').notNull(),round:integer('round').notNull().default(1),
  automaticQualifiers:text('automatic_qualifiers').notNull().default('[]'),
  status:text('status').notNull().default('active'),qualified:text('qualified').notNull().default('[]'),version:integer('version').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[index('playoff_tournament').on(t.tournamentId),check('playoff_target',sql`${t.target} >= 1`),check('playoff_elo_mode',sql`${t.eloMode} IN ('match','tie')`)]);
export const playoffTies=sqliteTable('playoff_ties',{
  id:text('id').primaryKey(),playoffId:text('playoff_id').notNull().references(()=>playoffs.id),round:integer('round').notNull(),position:integer('position').notNull(),
  playerA:text('player_a').notNull().references(()=>communityPlayers.id),playerB:text('player_b').references(()=>communityPlayers.id),
},t=>[uniqueIndex('playoff_tie_position').on(t.playoffId,t.round,t.position),check('playoff_distinct_players',sql`${t.playerB} IS NULL OR ${t.playerA} <> ${t.playerB}`)]);

import { sqliteTable, text, integer, uniqueIndex, index, primaryKey, check } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';

export const accounts=sqliteTable('accounts',{
  id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  passwordHash:text('password_hash').notNull(),owner:integer('owner').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('account_email').on(t.email).where(sql`${t.email} <> ''`),uniqueIndex('account_single_owner').on(t.owner).where(sql`${t.owner} = 1`)]);
export const sessions=sqliteTable('sessions',{
  tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),expiresAt:integer('expires_at').notNull(),
},t=>[index('session_account').on(t.accountId)]);
export const accountProfiles=sqliteTable('account_profiles',{
  accountId:text('account_id').primaryKey().references(()=>accounts.id),data:text('data').notNull(),
  version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const invitations=sqliteTable('invitations',{
  tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  tournamentId:text('tournament_id').notNull().references(()=>tournaments.id),expiresAt:integer('expires_at').notNull(),
  username:text('username').references(()=>accountUsernames.username),
},t=>[index('invitation_email').on(t.email),uniqueIndex('invitation_username').on(t.username).where(sql`${t.username} IS NOT NULL`)]);
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
  username:text('username').references(()=>accountUsernames.username),
}, t=>[uniqueIndex("member_email").on(t.tournamentId,t.email).where(sql`${t.email} <> ''`),uniqueIndex("member_manager").on(t.tournamentId,t.managerId),uniqueIndex('member_player').on(t.tournamentId,t.playerId),uniqueIndex('member_username').on(t.tournamentId,t.username).where(sql`${t.username} IS NOT NULL`), index("member_user").on(t.userId)]);
export const matchweekControl=sqliteTable('matchweek_control',{
  tournamentId:text('tournament_id').primaryKey().references(()=>tournaments.id),
  currentWeek:integer('current_week').notNull(),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),
},t=>[check('matchweek_positive',sql`${t.currentWeek} >= 1`)]);
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
export const accountUsernames=sqliteTable('account_usernames',{
  username:text('username').primaryKey(),accountId:text('account_id').references(()=>accounts.id),
  playerId:text('player_id').references(()=>communityPlayers.id),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('username_account').on(t.accountId),uniqueIndex('username_player').on(t.playerId),
  check('username_format',sql`length(${t.username}) BETWEEN 3 AND 24 AND ${t.username}=lower(${t.username}) AND ${t.username} NOT GLOB '*[^a-z0-9_]*'`)]);
export const accountAccessAudit=sqliteTable('account_access_audit',{
  id:text('id').primaryKey(),actorId:text('actor_id').notNull().references(()=>accounts.id),
  targetAccountId:text('target_account_id').references(()=>accounts.id),username:text('username').notNull(),
  action:text('action').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('account_access_actor').on(t.actorId,t.createdAt)]);
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

// 0010: optional Discord connection (no tokens stored; one identity per account).
export const discordLinks=sqliteTable('discord_links',{
  accountId:text('account_id').primaryKey().references(()=>accounts.id),discordUserId:text('discord_user_id').notNull(),
  discordName:text('discord_name').notNull(),linkedAt:text('linked_at').notNull(),
},t=>[uniqueIndex('discord_link_user').on(t.discordUserId),
  check('discord_user_id_format',sql`length(${t.discordUserId}) BETWEEN 15 AND 22 AND ${t.discordUserId} NOT GLOB '*[^0-9]*'`)]);
export const discordOauthStates=sqliteTable('discord_oauth_states',{
  stateHash:text('state_hash').primaryKey(),purpose:text('purpose').notNull(),accountId:text('account_id').references(()=>accounts.id),
  browserHash:text('browser_hash').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('discord_state_expiry').on(t.expiresAt)]);
export const discordLinkAudit=sqliteTable('discord_link_audit',{
  id:text('id').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),discordUserId:text('discord_user_id').notNull(),
  action:text('action').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('discord_audit_account').on(t.accountId,t.createdAt)]);

// Milestone: match scheduling (migration 0011). Documentation mirror; the runtime uses the SQL migration.
export const scheduleSettings = sqliteTable("schedule_settings", {
  tournamentId: text("tournament_id").primaryKey().references(() => tournaments.id),
  bookingMinutes: integer("booking_minutes"), seasonStart: text("season_start"), seasonEnd: text("season_end"),
  version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(),
});
export const scheduleWindows = sqliteTable("schedule_windows", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  matchday: integer("matchday"), fixtureId: text("fixture_id").references(() => fixtures.id),
  opensAt: text("opens_at"), deadlineAt: text("deadline_at"),
  version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(),
});
export const scheduleProposals = sqliteTable("schedule_proposals", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id), kind: text("kind").notNull(),
  proposedAt: text("proposed_at").notNull(), proposedLocal: text("proposed_local").notNull(), proposerTimezone: text("proposer_timezone").notNull(),
  baseKickoff: text("base_kickoff"), proposerAccountId: text("proposer_account_id").notNull(), proposerName: text("proposer_name").notNull(),
  proposerSide: text("proposer_side").notNull(), responderSide: text("responder_side").notNull(), parentId: text("parent_id"),
  message: text("message"), status: text("status").notNull(), beyondDeadline: integer("beyond_deadline").notNull().default(0),
  decidedBy: text("decided_by"), decidedReason: text("decided_reason"), createdAt: text("created_at").notNull(), decidedAt: text("decided_at"),
  version: integer("version").notNull().default(1),
});
export const scheduleEvents = sqliteTable("schedule_events", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(() => tournaments.id),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id), proposalId: text("proposal_id"),
  actorId: text("actor_id"), actorName: text("actor_name").notNull(), at: text("at").notNull(), action: text("action").notNull(),
  reason: text("reason"), kickoffBefore: text("kickoff_before"), kickoffAfter: text("kickoff_after"), proposedAt: text("proposed_at"),
});

// Milestone: friendly invitations (migration 0012). Documentation mirror; the runtime uses the SQL migration.
export const friendlyInvitations = sqliteTable("friendly_invitations", {
  id: text("id").primaryKey(), inviterId: text("inviter_id").notNull().references(() => accounts.id), inviteeId: text("invitee_id").notNull().references(() => accounts.id),
  pairKey: text("pair_key").notNull(), status: text("status").notNull(),
  proposedAt: text("proposed_at").notNull(), proposedLocal: text("proposed_local").notNull(), proposerTimezone: text("proposer_timezone").notNull(),
  proposedBy: text("proposed_by").notNull().references(() => accounts.id), turnId: text("turn_id").references(() => accounts.id),
  message: text("message"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(), version: integer("version").notNull().default(1),
});
export const friendlyEvents = sqliteTable("friendly_events", {
  id: text("id").primaryKey(), invitationId: text("invitation_id").notNull().references(() => friendlyInvitations.id),
  actorId: text("actor_id"), actorName: text("actor_name").notNull(), at: text("at").notNull(), action: text("action").notNull(),
  reason: text("reason"), proposedAt: text("proposed_at"),
});

// Milestone: profile pictures (migration 0013). Documentation mirror; the runtime uses the SQL migration.
export const accountAvatars = sqliteTable("account_avatars", {
  accountId: text("account_id").primaryKey().references(() => accounts.id),
  mime: text("mime").notNull(), data: text("data").notNull(), width: integer("width").notNull(), height: integer("height").notNull(),
  version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(),
});

// Milestone: user management (migration 0014). Documentation mirror; the runtime uses the SQL migration.
export const accountStatus = sqliteTable("account_status", {
  accountId: text("account_id").primaryKey().references(() => accounts.id),
  disabledAt: text("disabled_at").notNull(), reason: text("reason").notNull(),
  disabledBy: text("disabled_by").notNull().references(() => accounts.id),
});

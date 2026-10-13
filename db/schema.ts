import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const accounts=sqliteTable('accounts',{
  id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),
  passwordHash:text('password_hash').notNull(),owner:integer('owner').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('account_email').on(t.email)]);
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
}, t=>[uniqueIndex("member_email").on(t.tournamentId,t.email),uniqueIndex("member_manager").on(t.tournamentId,t.managerId), index("member_user").on(t.userId)]);
export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull().references(()=>tournaments.id),
  home: text("home").notNull(), away: text("away").notNull(), stage: text("stage").notNull(),
  matchday: integer("matchday").notNull(), scheduled: text("scheduled"),
  status: text("status").notNull().default("scheduled"), report: text("report"),
  submittedBy: text("submitted_by"), submittedManager: text("submitted_manager"),
  submittedAt: text("submitted_at"), finalizedAt: text("finalized_at"), note: text("note"),
  version: integer("version").notNull().default(0), mutation: text("mutation"),
}, t=>[index("fixture_tournament").on(t.tournamentId),uniqueIndex("fixture_pair").on(t.tournamentId,t.stage,t.matchday,t.home,t.away)]);
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

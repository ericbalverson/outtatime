import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { ReportData } from "@/lib/report-types";

// ---------------------------------------------------------------------------
// Auth.js tables
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // IANA zone, e.g. "America/Chicago". Null until the user finishes onboarding.
  timezone: text("timezone"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** A "run" of projects. "New instance" ends the current one and starts another. */
export const instances = pgTable(
  "instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startedAt: tstz("started_at").notNull().defaultNow(),
    endedAt: tstz("ended_at"),
  },
  (t) => [
    // At most one active instance per user.
    uniqueIndex("instance_one_active").on(t.userId).where(sql`${t.endedAt} is null`),
  ],
);

export const projects = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: tstz("created_at").notNull().defaultNow(),
    // Soft delete: hidden from the dashboard but kept for reports.
    deletedAt: tstz("deleted_at"),
  },
  (t) => [index("project_user_instance").on(t.userId, t.instanceId)],
);

export const timeEntries = pgTable(
  "time_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    startedAt: tstz("started_at").notNull(),
    // Null while the timer is running.
    endedAt: tstz("ended_at"),
  },
  (t) => [
    index("entry_project").on(t.projectId),
    index("entry_user_started").on(t.userId, t.startedAt),
    // A project can only have one running timer, even across browsers.
    uniqueIndex("entry_one_running").on(t.projectId).where(sql`${t.endedAt} is null`),
  ],
);

/** Frozen report snapshots. `data` is computed once at creation and never recomputed. */
export const reports = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    range: text("range").$type<"week" | "all">().notNull(),
    totalBasis: text("total_basis").$type<"instance" | "all">().notNull(),
    instanceId: uuid("instance_id").references(() => instances.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    data: jsonb("data").$type<ReportData>().notNull(),
  },
  (t) => [index("report_user_created").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Instance = typeof instances.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Report = typeof reports.$inferSelect;

"use server";

import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { instances, projects, reports, timeEntries, users } from "@/db/schema";
import { PROJECT_COLORS } from "@/lib/colors";
import { buildReport } from "@/lib/report";
import { getActiveInstance, requireOnboardedUser, requireUser } from "@/lib/session";
import { fmtDate, fromLocalInput, isValidTimezone } from "@/lib/time";

type Result = { error?: string };

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

async function ownedProject(userId: string, projectId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
}

// ---------------------------------------------------------------------------
// Auth & account
// ---------------------------------------------------------------------------

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInDev() {
  await signIn("dev", { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function setTimezone(timezone: string): Promise<Result> {
  const user = await requireUser();
  if (!isValidTimezone(timezone)) return { error: "Unknown timezone." };
  await db.update(users).set({ timezone }).where(eq(users.id, user.id));
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(name: string, color?: string): Promise<Result> {
  const user = await requireOnboardedUser();
  name = name.trim().slice(0, 80);
  if (!name) return { error: "Project name is required." };
  const instance = await getActiveInstance(user.id);
  const [{ maxPos, count }] = await db
    .select({ maxPos: max(projects.position), count: sql<number>`count(*)::int` })
    .from(projects)
    .where(eq(projects.instanceId, instance.id));
  await db.insert(projects).values({
    userId: user.id,
    instanceId: instance.id,
    name,
    color: color && PROJECT_COLORS.includes(color) ? color : PROJECT_COLORS[count % PROJECT_COLORS.length],
    position: (maxPos ?? -1) + 1,
  });
  refresh();
  return {};
}

export async function updateProject(projectId: string, patch: { name?: string; color?: string }): Promise<Result> {
  const user = await requireOnboardedUser();
  const set: { name?: string; color?: string } = {};
  if (patch.name !== undefined) {
    set.name = patch.name.trim().slice(0, 80);
    if (!set.name) return { error: "Project name is required." };
  }
  if (patch.color !== undefined && PROJECT_COLORS.includes(patch.color)) set.color = patch.color;
  await db
    .update(projects)
    .set(set)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  refresh();
  return {};
}

/** Soft delete: the tile disappears but its time stays in reports. */
export async function deleteProject(projectId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  await db
    .update(timeEntries)
    .set({ endedAt: sql`now()` })
    .where(and(eq(timeEntries.projectId, projectId), eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)));
  await db
    .update(projects)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

export async function startTimer(projectId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  const project = await ownedProject(user.id, projectId);
  if (!project || project.deletedAt) return { error: "Project not found." };
  const instance = await getActiveInstance(user.id);
  if (project.instanceId !== instance.id) return { error: "That project belongs to a finished instance." };
  // The partial unique index makes a second start (e.g. from another browser) a no-op.
  await db
    .insert(timeEntries)
    .values({ userId: user.id, projectId, startedAt: sql`now()` })
    .onConflictDoNothing();
  refresh();
  return {};
}

export async function stopTimer(projectId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  await db
    .update(timeEntries)
    .set({ endedAt: sql`now()` })
    .where(and(eq(timeEntries.projectId, projectId), eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)));
  refresh();
  return {};
}

export async function stopAllTimers(): Promise<Result> {
  const user = await requireOnboardedUser();
  await db
    .update(timeEntries)
    .set({ endedAt: sql`now()` })
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)));
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Time entries (manual edits)
// ---------------------------------------------------------------------------

export type EntryDTO = { id: string; startedAt: string; endedAt: string | null };

export async function listEntries(projectId: string): Promise<EntryDTO[]> {
  const user = await requireOnboardedUser();
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.projectId, projectId), eq(timeEntries.userId, user.id)))
    .orderBy(desc(timeEntries.startedAt));
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
  }));
}

function parseRange(tz: string, start: string, end: string | null) {
  const s = fromLocalInput(start, tz);
  if (!s) return { error: "Invalid start time." } as const;
  if (end === null) return { start: s, end: null } as const;
  const e = fromLocalInput(end, tz);
  if (!e) return { error: "Invalid stop time." } as const;
  if (e <= s) return { error: "Stop time must be after start time." } as const;
  if (e.getTime() > Date.now() + 60_000) return { error: "Stop time can't be in the future." } as const;
  return { start: s, end: e } as const;
}

/** Start/end are datetime-local strings in the user's timezone. `end` null keeps a running entry running. */
export async function updateEntry(entryId: string, start: string, end: string | null): Promise<Result> {
  const user = await requireOnboardedUser();
  const entry = await db.query.timeEntries.findFirst({
    where: and(eq(timeEntries.id, entryId), eq(timeEntries.userId, user.id)),
  });
  if (!entry) return { error: "Entry not found." };
  if (end === null && entry.endedAt !== null) return { error: "Stop time is required." };
  const range = parseRange(user.timezone, start, end);
  if ("error" in range) return { error: range.error };
  if (range.start.getTime() > Date.now()) return { error: "Start time can't be in the future." };
  await db
    .update(timeEntries)
    .set({ startedAt: range.start, ...(range.end ? { endedAt: range.end } : {}) })
    .where(eq(timeEntries.id, entryId));
  refresh();
  return {};
}

export async function addEntry(projectId: string, start: string, end: string): Promise<Result> {
  const user = await requireOnboardedUser();
  const project = await ownedProject(user.id, projectId);
  if (!project) return { error: "Project not found." };
  const range = parseRange(user.timezone, start, end);
  if ("error" in range) return { error: range.error };
  await db.insert(timeEntries).values({ userId: user.id, projectId, startedAt: range.start, endedAt: range.end });
  refresh();
  return {};
}

export async function deleteEntry(entryId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  await db.delete(timeEntries).where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, user.id)));
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function defaultTitle(range: "week" | "all", basis: "instance" | "all", instanceName: string, tz: string) {
  const when = fmtDate(new Date(), tz);
  if (range === "week") return `Weekly report — ${when}`;
  return basis === "instance" ? `${instanceName} report — ${when}` : `All-time report — ${when}`;
}

async function insertReport(
  user: Awaited<ReturnType<typeof requireOnboardedUser>>,
  instance: { id: string; name: string },
  range: "week" | "all",
  totalBasis: "instance" | "all",
  title?: string,
) {
  const data = await buildReport({ user, instanceId: instance.id, range, totalBasis });
  const [row] = await db
    .insert(reports)
    .values({
      userId: user.id,
      title: title?.trim().slice(0, 120) || defaultTitle(range, totalBasis, instance.name, user.timezone),
      range,
      totalBasis,
      instanceId: instance.id,
      data,
    })
    .returning({ id: reports.id });
  return row.id;
}

export async function createReport(input: {
  range: "week" | "all";
  totalBasis: "instance" | "all";
  title?: string;
}) {
  const user = await requireOnboardedUser();
  const range = input.range === "week" ? "week" : "all";
  const totalBasis = input.totalBasis === "all" ? "all" : "instance";
  const instance = await getActiveInstance(user.id);
  const id = await insertReport(user, instance, range, totalBasis, input.title);
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function renameReport(reportId: string, title: string): Promise<Result> {
  const user = await requireOnboardedUser();
  title = title.trim().slice(0, 120);
  if (!title) return { error: "Title is required." };
  await db
    .update(reports)
    .set({ title })
    .where(and(eq(reports.id, reportId), eq(reports.userId, user.id)));
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  return {};
}

export async function deleteReport(reportId: string): Promise<Result> {
  const user = await requireOnboardedUser();
  await db.delete(reports).where(and(eq(reports.id, reportId), eq(reports.userId, user.id)));
  revalidatePath("/reports");
  return {};
}

// ---------------------------------------------------------------------------
// New instance
// ---------------------------------------------------------------------------

export async function startNewInstance(input: {
  name?: string;
  keepProjects: boolean;
  saveReport: boolean;
}): Promise<Result> {
  const user = await requireOnboardedUser();
  const current = await getActiveInstance(user.id);

  await db
    .update(timeEntries)
    .set({ endedAt: sql`now()` })
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.endedAt)));

  if (input.saveReport) {
    await insertReport(user, current, "all", "instance", `${current.name} — final report (${fmtDate(new Date(), user.timezone)})`);
  }

  const keep = input.keepProjects
    ? await db
        .select({ name: projects.name, color: projects.color, position: projects.position })
        .from(projects)
        .where(and(eq(projects.instanceId, current.id), isNull(projects.deletedAt)))
        .orderBy(asc(projects.position))
    : [];

  const count = (await db.select({ id: instances.id }).from(instances).where(eq(instances.userId, user.id))).length;
  const name = input.name?.trim().slice(0, 80) || `Instance ${count + 1}`;

  await db.transaction(async (tx) => {
    await tx
      .update(instances)
      .set({ endedAt: sql`now()` })
      .where(and(eq(instances.id, current.id), isNull(instances.endedAt)));
    const [next] = await tx.insert(instances).values({ userId: user.id, name }).returning();
    if (keep.length) {
      await tx
        .insert(projects)
        .values(keep.map((p) => ({ userId: user.id, instanceId: next.id, name: p.name, color: p.color, position: p.position })));
    }
  });

  refresh();
  return {};
}

/** Persist tile order; `ids` is the full ordered list of visible project ids. */
export async function reorderProjects(ids: string[]): Promise<Result> {
  const user = await requireOnboardedUser();
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), inArray(projects.id, ids)));
  const ok = new Set(owned.map((o) => o.id));
  await Promise.all(
    ids.filter((id) => ok.has(id)).map((id, i) => db.update(projects).set({ position: i }).where(eq(projects.id, id))),
  );
  refresh();
  return {};
}

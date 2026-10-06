import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import { weekBounds } from "./time";

export type TileData = {
  id: string;
  name: string;
  color: string;
  /** Finished time only; the client adds the live running portion. */
  closedMs: number;
  closedWeekMs: number;
  runningSince: string | null;
};

export async function getDashboard(userId: string, instanceId: string, tz: string) {
  const now = new Date();
  const { start, end } = weekBounds(now, tz);
  const ws = start.toUTC().toISO()!;
  const we = end.toUTC().toISO()!;

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      closedMs: sql<string>`coalesce(sum(extract(epoch from (${timeEntries.endedAt} - ${timeEntries.startedAt})) * 1000), 0)`,
      closedWeekMs: sql<string>`coalesce(sum(greatest(0, extract(epoch from (least(${timeEntries.endedAt}, ${we}::timestamptz) - greatest(${timeEntries.startedAt}, ${ws}::timestamptz))) * 1000)) filter (where ${timeEntries.endedAt} is not null), 0)`,
      runningSince: sql<Date | string | null>`max(case when ${timeEntries.endedAt} is null then ${timeEntries.startedAt} end)`,
    })
    .from(projects)
    .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
    .where(and(eq(projects.userId, userId), eq(projects.instanceId, instanceId), isNull(projects.deletedAt)))
    .groupBy(projects.id)
    .orderBy(asc(projects.position), asc(projects.createdAt));

  const tiles: TileData[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    closedMs: Math.round(Number(r.closedMs)),
    closedWeekMs: Math.round(Number(r.closedWeekMs)),
    runningSince: r.runningSince ? new Date(r.runningSince).toISOString() : null,
  }));

  return { tiles, weekStart: ws, weekEnd: we, serverNow: now.getTime() };
}

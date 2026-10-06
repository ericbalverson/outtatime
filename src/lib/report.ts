import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { instances, projects, timeEntries, type User } from "@/db/schema";
import type { ReportData, ReportProject, Summary } from "./report-types";
import { overlapMs, splitByWeek, weekBounds } from "./time";

type ProjectInfo = { id: string; name: string; color: string; deleted: boolean; instanceName: string };

function summarize(totals: Map<string, number>, info: Map<string, ProjectInfo>): Summary {
  const totalMs = [...totals.values()].reduce((a, b) => a + b, 0);
  const rows = [...totals.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([projectId, ms]) => {
      const p = info.get(projectId)!;
      return {
        projectId,
        name: p.name,
        color: p.color,
        deleted: p.deleted,
        ms,
        pct: totalMs > 0 ? (ms / totalMs) * 100 : 0,
      };
    })
    .sort((a, b) => b.ms - a.ms);
  return { totalMs, rows };
}

function add(map: Map<string, number>, key: string, ms: number) {
  map.set(key, (map.get(key) ?? 0) + ms);
}

/**
 * Build a frozen report snapshot.
 *  - totalBasis "instance": only projects in `instanceId`; "all": every project the user ever had.
 *  - range "week": weekly breakdown + detailed log limited to the current Mon–Sun week.
 */
export async function buildReport(opts: {
  user: User & { timezone: string };
  instanceId: string;
  range: "week" | "all";
  totalBasis: "instance" | "all";
  now?: Date;
}): Promise<ReportData> {
  const { user, instanceId, range, totalBasis } = opts;
  const tz = user.timezone;
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      deletedAt: projects.deletedAt,
      position: projects.position,
      instanceName: instances.name,
      instanceStart: instances.startedAt,
    })
    .from(projects)
    .innerJoin(instances, eq(projects.instanceId, instances.id))
    .where(
      totalBasis === "instance"
        ? and(eq(projects.userId, user.id), eq(projects.instanceId, instanceId))
        : eq(projects.userId, user.id),
    )
    .orderBy(asc(instances.startedAt), asc(projects.position), asc(projects.createdAt));

  const info = new Map<string, ProjectInfo>(
    projectRows.map((p) => [
      p.id,
      { id: p.id, name: p.name, color: p.color, deleted: !!p.deletedAt, instanceName: p.instanceName },
    ]),
  );

  const entries = projectRows.length
    ? await db
        .select()
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.userId, user.id),
            inArray(
              timeEntries.projectId,
              projectRows.map((p) => p.id),
            ),
          ),
        )
        .orderBy(asc(timeEntries.startedAt))
    : [];

  const { start: wkStart, end: wkEnd } = weekBounds(now, tz);
  const wkStartMs = wkStart.toMillis();
  const wkEndMs = wkEnd.toMillis();

  const totalByProject = new Map<string, number>();
  const weekByProject = new Map<string, number>();
  const byWeek = new Map<string, Map<string, number>>();
  const detail = new Map<string, ReportProject>();

  for (const e of entries) {
    const start = e.startedAt.getTime();
    const running = e.endedAt === null;
    const end = running ? nowMs : e.endedAt!.getTime();
    if (end <= start) continue;
    const ms = end - start;

    add(totalByProject, e.projectId, ms);
    const inWeek = overlapMs(start, end, wkStartMs, wkEndMs);
    add(weekByProject, e.projectId, inWeek);

    for (const seg of splitByWeek(start, end, tz)) {
      if (range === "week" && seg.weekStartMs !== wkStartMs) continue;
      let m = byWeek.get(seg.weekKey);
      if (!m) byWeek.set(seg.weekKey, (m = new Map()));
      add(m, e.projectId, seg.ms);
    }

    if (range === "week" && inWeek === 0) continue;
    const p = info.get(e.projectId)!;
    let rp = detail.get(e.projectId);
    if (!rp) detail.set(e.projectId, (rp = { ...p, totalMs: 0, entries: [] }));
    rp.entries.push({
      start: e.startedAt.toISOString(),
      end: new Date(end).toISOString(),
      ms: range === "week" ? inWeek : ms,
      running,
    });
    rp.totalMs += range === "week" ? inWeek : ms;
  }

  // Keep project order stable (instance, then tile position); include projects with no time.
  const detailProjects: ReportProject[] = projectRows
    .map((p) => detail.get(p.id) ?? { ...info.get(p.id)!, totalMs: 0, entries: [] })
    .filter((p) => p.entries.length > 0 || (!p.deleted && range === "all"));

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([weekStart, m]) => ({ weekStart, summary: summarize(m, info) }));

  const activeInstance = projectRows.length
    ? null
    : await db.query.instances.findFirst({ where: eq(instances.id, instanceId) });
  const instanceName =
    totalBasis === "instance"
      ? (projectRows[0]?.instanceName ?? activeInstance?.name ?? null)
      : null;

  return {
    version: 1,
    generatedAt: now.toISOString(),
    timezone: tz,
    user: { name: user.name, email: user.email },
    range,
    totalBasis,
    instanceName,
    currentWeek: { start: wkStart.toISODate()!, end: wkEnd.minus({ days: 1 }).toISODate()! },
    thisWeek: summarize(weekByProject, info),
    total: summarize(totalByProject, info),
    weeks,
    projects: detailProjects,
  };
}

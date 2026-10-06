import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ReportsList } from "@/components/ReportsList";
import { getActiveInstance, requireOnboardedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireOnboardedUser();
  const instance = await getActiveInstance(user.id);
  const rows = await db
    .select({
      id: reports.id,
      title: reports.title,
      range: reports.range,
      totalBasis: reports.totalBasis,
      createdAt: reports.createdAt,
      totalMs: sql<string>`${reports.data}->'total'->>'totalMs'`,
      weekMs: sql<string>`${reports.data}->'thisWeek'->>'totalMs'`,
      instanceName: sql<string | null>`${reports.data}->>'instanceName'`,
    })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(desc(reports.createdAt));

  return (
    <ReportsList
      timezone={user.timezone}
      instanceName={instance.name}
      reports={rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        totalMs: Number(r.totalMs) || 0,
        weekMs: Number(r.weekMs) || 0,
      }))}
    />
  );
}

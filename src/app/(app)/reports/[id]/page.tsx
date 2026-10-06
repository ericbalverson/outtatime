import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { ReportView } from "@/components/ReportView";
import { requireOnboardedUser } from "@/lib/session";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const report = await db.query.reports.findFirst({
    where: and(eq(reports.id, id), eq(reports.userId, user.id)),
  });
  if (!report) notFound();
  return <ReportView title={report.title} data={report.data} />;
}

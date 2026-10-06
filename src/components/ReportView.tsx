"use client";

import Link from "next/link";
import { useState } from "react";
import { describe, exportCsv, exportPdf, exportXlsx } from "@/lib/export";
import type { ReportData, Summary } from "@/lib/report-types";
import { fmtDateTime, fmtWeekRange, formatClock, formatHM } from "@/lib/time";
import { Button } from "./ui";

export function ReportView({ title, data }: { title: string; data: ReportData }) {
  const info = describe(data);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="report space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/reports" className="text-sm text-zinc-500 hover:text-zinc-300 print:hidden">
            ← All reports
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{title}</h1>
          <dl className="mt-2 grid gap-x-6 gap-y-0.5 text-sm text-zinc-400 sm:grid-cols-[auto_1fr]">
            <dt className="text-zinc-500">Generated</dt>
            <dd>
              {info.generated} <span className="text-zinc-600">({data.timezone.replaceAll("_", " ")})</span>
            </dd>
            <dt className="text-zinc-500">Period</dt>
            <dd>{info.period}</dd>
            <dt className="text-zinc-500">Total covers</dt>
            <dd>{info.basis}</dd>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="primary" disabled={!!busy} onClick={() => run("pdf", () => exportPdf(data, title))}>
            {busy === "pdf" ? "Building…" : "PDF"}
          </Button>
          <Button disabled={!!busy} onClick={() => run("xlsx", () => exportXlsx(data, title))}>
            {busy === "xlsx" ? "Building…" : "Excel"}
          </Button>
          <Button disabled={!!busy} onClick={() => run("csv", () => exportCsv(data, title))}>
            CSV
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard label="This week" sub={fmtWeekRange(data.currentWeek.start, data.timezone)} summary={data.thisWeek} />
        <SummaryCard label="Total time worked" sub={info.basis} summary={data.total} />
      </div>

      {data.weeks.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">Work weeks</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.weeks.map((w) => (
              <SummaryCard key={w.weekStart} label={fmtWeekRange(w.weekStart, data.timezone)} summary={w.summary} compact />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Detailed time log</h2>
        <div className="space-y-4">
          {data.projects.filter((p) => p.entries.length).length === 0 && <p className="text-sm text-zinc-500">No time entries in this report.</p>}
          {data.projects
            .filter((p) => p.entries.length)
            .map((p) => (
              <div key={p.id} className="avoid-break overflow-hidden rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/70 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="font-medium text-zinc-100">
                    {p.name}
                    {p.deleted && <span className="ml-2 text-xs text-zinc-500">(deleted)</span>}
                  </span>
                  {data.totalBasis === "all" && <span className="text-xs text-zinc-500">{p.instanceName}</span>}
                  <span className="ml-auto font-mono text-sm text-zinc-300 tabular">{formatHM(p.totalMs)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Started</th>
                        <th className="px-4 py-2 font-medium">Stopped</th>
                        <th className="px-4 py-2 text-right font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {p.entries.map((e, i) => (
                        <tr key={i} className="text-zinc-300">
                          <td className="whitespace-nowrap px-4 py-2">{fmtDateTime(e.start, data.timezone)}</td>
                          <td className="whitespace-nowrap px-4 py-2">
                            {e.running ? <span className="text-emerald-400">Running at report time</span> : fmtDateTime(e.end, data.timezone)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular">{formatClock(e.ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
        {data.range === "week" && (
          <p className="mt-3 text-xs text-zinc-500">Entries that cross into another week count only their time inside this week.</p>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, sub, summary, compact }: { label: string; sub?: string; summary: Summary; compact?: boolean }) {
  return (
    <section className="avoid-break rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className={`${compact ? "text-sm" : "text-base"} font-medium text-zinc-200`}>{label}</h3>
          {sub && <p className="text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`font-mono ${compact ? "text-lg" : "text-2xl"} font-semibold text-zinc-50 tabular`}>{formatHM(summary.totalMs)}</div>
      </div>
      {summary.rows.length > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-zinc-800">
          {summary.rows.map((r) => (
            <div key={r.projectId} style={{ width: `${r.pct}%`, background: r.color }} title={`${r.name} ${r.pct.toFixed(1)}%`} />
          ))}
        </div>
      )}
      <table className="mt-4 w-full text-sm">
        <tbody>
          {summary.rows.length === 0 && (
            <tr>
              <td className="py-1 text-zinc-500">No time logged.</td>
            </tr>
          )}
          {summary.rows.map((r) => (
            <tr key={r.projectId} className="text-zinc-300">
              <td className="py-1">
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.name}
                {r.deleted && <span className="ml-1 text-xs text-zinc-500">(deleted)</span>}
              </td>
              <td className="py-1 text-right font-mono tabular">{formatHM(r.ms)}</td>
              <td className="w-16 py-1 text-right font-mono text-zinc-500 tabular">{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

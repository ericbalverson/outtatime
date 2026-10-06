"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteReport, renameReport } from "@/app/actions";
import { fmtDateTime, formatHM } from "@/lib/time";
import { ReportDialog } from "./ReportDialog";
import { Button, Modal, inputClass } from "./ui";

type Row = {
  id: string;
  title: string;
  range: "week" | "all";
  totalBasis: "instance" | "all";
  createdAt: string;
  totalMs: number;
  weekMs: number;
  instanceName: string | null;
};

export function ReportsList({ reports, timezone, instanceName }: { reports: Row[]; timezone: string; instanceName: string }) {
  const [genOpen, setGenOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [toRename, setToRename] = useState<Row | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const badge = "rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Reports</h1>
          <p className="text-sm text-zinc-500">Saved snapshots. They stay here until you delete them, even after a new instance.</p>
        </div>
        <Button variant="primary" onClick={() => setGenOpen(true)}>
          Generate report
        </Button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center text-zinc-400">No reports yet.</div>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <Link href={`/reports/${r.id}`} className="group min-w-0 flex-1">
                <div className="truncate font-medium text-zinc-100 group-hover:text-blue-300">{r.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{fmtDateTime(r.createdAt, timezone)}</span>
                  <span className={badge}>{r.range === "week" ? "This week" : "Full"}</span>
                  <span className={badge}>{r.totalBasis === "instance" ? (r.instanceName ?? "Instance") : "All time"}</span>
                </div>
              </Link>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500">Week</div>
                  <div className="font-mono text-sm text-zinc-300 tabular">{formatHM(r.weekMs)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500">Total</div>
                  <div className="font-mono text-sm text-zinc-100 tabular">{formatHM(r.totalMs)}</div>
                </div>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1"
                    onClick={() => {
                      setNewTitle(r.title);
                      setToRename(r);
                    }}
                  >
                    Rename
                  </Button>
                  <Button variant="ghost" className="!px-2 !py-1 !text-rose-400" onClick={() => setToDelete(r)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReportDialog open={genOpen} onClose={() => setGenOpen(false)} instanceName={instanceName} />

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete report?">
        <p className="text-sm text-zinc-400">
          “{toDelete?.title}” will be permanently deleted. Your time entries are not affected.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteReport(toDelete!.id);
                setError(res.error);
                setToDelete(null);
              })
            }
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Modal open={!!toRename} onClose={() => setToRename(null)} title="Rename report">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await renameReport(toRename!.id, newTitle);
              setError(res.error);
              if (!res.error) setToRename(null);
            });
          }}
        >
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120} className={inputClass} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setToRename(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending || !newTitle.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

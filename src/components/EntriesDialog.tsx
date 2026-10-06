"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { addEntry, deleteEntry, listEntries, updateEntry, type EntryDTO } from "@/app/actions";
import type { TileData } from "@/lib/dashboard";
import { fmtDateTime, formatClock, toLocalInput } from "@/lib/time";
import { Button, Modal, inputClass } from "./ui";

export function EntriesDialog({
  project,
  timezone,
  onClose,
}: {
  project: TileData | null;
  timezone: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<EntryDTO[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    if (!project) return;
    start(async () => setEntries(await listEntries(project.id)));
  }, [project]);

  useEffect(() => {
    setEntries(null);
    setEditing(null);
    setError(undefined);
    load();
  }, [load]);

  const save = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.error);
      if (!res.error) {
        setEditing(null);
        setEntries(await listEntries(project!.id));
      }
    });

  return (
    <Modal open={!!project} onClose={onClose} title={project ? `${project.name} — time entries` : ""} wide>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">Times shown in {timezone.replaceAll("_", " ")}.</p>

      {editing === "new" ? (
        <EntryForm
          timezone={timezone}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(s, e) => save(() => addEntry(project!.id, s, e!))}
        />
      ) : (
        <Button onClick={() => setEditing("new")} className="mb-4">
          + Add time manually
        </Button>
      )}

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {entries === null && <p className="text-sm text-zinc-500">Loading…</p>}
        {entries?.length === 0 && <p className="text-sm text-zinc-500">No time logged yet.</p>}
        {entries?.map((e) =>
          editing === e.id ? (
            <EntryForm
              key={e.id}
              entry={e}
              timezone={timezone}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={(s, end) => save(() => updateEntry(e.id, s, end))}
            />
          ) : (
            <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-800 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="text-zinc-200">{fmtDateTime(e.startedAt, timezone)}</div>
                <div className="text-zinc-500">
                  → {e.endedAt ? fmtDateTime(e.endedAt, timezone) : <span className="text-emerald-400">running</span>}
                </div>
              </div>
              <div className="font-mono text-zinc-300 tabular">
                {e.endedAt ? formatClock(Date.parse(e.endedAt) - Date.parse(e.startedAt)) : "—"}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" className="!px-2 !py-1" onClick={() => setEditing(e.id)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 !text-rose-400"
                  disabled={pending}
                  onClick={() => confirm("Delete this time entry? This can't be undone.") && save(() => deleteEntry(e.id))}
                >
                  Delete
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
    </Modal>
  );
}

function EntryForm({
  entry,
  timezone,
  pending,
  onSave,
  onCancel,
}: {
  entry?: EntryDTO;
  timezone: string;
  pending: boolean;
  onSave: (start: string, end: string | null) => void;
  onCancel: () => void;
}) {
  const running = entry && !entry.endedAt;
  const [startV, setStart] = useState(() => toLocalInput(entry?.startedAt ?? new Date(Date.now() - 3_600_000), timezone));
  const [endV, setEnd] = useState(() => (running ? "" : toLocalInput(entry?.endedAt ?? new Date(), timezone)));

  return (
    <form
      className="mb-2 grid gap-3 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(startV, running ? null : endV);
      }}
    >
      <label className="text-xs text-zinc-400">
        Start
        <input type="datetime-local" value={startV} onChange={(e) => setStart(e.target.value)} className={`${inputClass} mt-1`} required />
      </label>
      <label className="text-xs text-zinc-400">
        Stop
        {running ? (
          <div className="mt-1 py-2 text-sm text-emerald-400">Still running</div>
        ) : (
          <input type="datetime-local" value={endV} onChange={(e) => setEnd(e.target.value)} className={`${inputClass} mt-1`} required />
        )}
      </label>
      <div className="flex items-end gap-2">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

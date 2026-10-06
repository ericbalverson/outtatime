"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteProject, updateProject } from "@/app/actions";
import { PROJECT_COLORS } from "@/lib/colors";
import type { TileData } from "@/lib/dashboard";
import { HOUR, formatClock, formatHM } from "@/lib/time";
import { Button, Modal, inputClass } from "./ui";

const LONG_RUN_MS = 10 * HOUR;

export function ProjectTile({
  tile,
  totalMs,
  weekMs,
  runMs,
  share,
  isFirst,
  isLast,
  onToggle,
  onEntries,
  onMove,
  onError,
}: {
  tile: TileData;
  totalMs: number;
  weekMs: number;
  runMs: number;
  share: number;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onEntries: () => void;
  onMove: (dir: -1 | 1) => void;
  onError: (e?: string) => void;
}) {
  const running = !!tile.runningSince;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const item = "block w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-40";

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border bg-zinc-900/70 p-5 transition ${
        running ? "border-transparent" : "border-zinc-800 hover:border-zinc-700"
      }`}
      style={running ? { boxShadow: `0 0 0 1.5px ${tile.color}, 0 0 32px -8px ${tile.color}` } : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tile.color }} />
        <h3 className="min-w-0 flex-1 break-words font-medium text-zinc-100">{tile.name}</h3>
        <div ref={menuRef} className="relative -mr-2 -mt-1">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Project menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
              <button className={item} onClick={() => (setMenuOpen(false), onEntries())}>
                Time entries…
              </button>
              <button className={item} onClick={() => (setMenuOpen(false), setEditOpen(true))}>
                Rename / color…
              </button>
              <button className={item} disabled={isFirst} onClick={() => (setMenuOpen(false), onMove(-1))}>
                Move earlier
              </button>
              <button className={item} disabled={isLast} onClick={() => (setMenuOpen(false), onMove(1))}>
                Move later
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <button
                className={`${item} !text-rose-400 hover:!text-rose-300`}
                onClick={() => (setMenuOpen(false), setConfirmDelete(true))}
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      <div suppressHydrationWarning className="mt-4 font-mono text-4xl font-semibold text-zinc-50 tabular">
        {formatClock(totalMs)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span suppressHydrationWarning>This week {formatHM(weekMs)}</span>
        <span suppressHydrationWarning>{share.toFixed(1)}% of total</span>
      </div>

      {running && runMs > LONG_RUN_MS && (
        <p className="mt-3 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
          Running for {formatHM(runMs)}. Forgot to stop? You can fix it under Time entries.
        </p>
      )}

      <button
        onClick={onToggle}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.99] ${
          running ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
        }`}
      >
        {running ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
            Stop
            <span suppressHydrationWarning className="font-mono font-normal opacity-80 tabular">
              {formatClock(runMs)}
            </span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
            Start
          </>
        )}
      </button>

      <EditProjectDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        tile={tile}
        onSave={(patch) =>
          start(async () => {
            const res = await updateProject(tile.id, patch);
            onError(res.error);
            if (!res.error) setEditOpen(false);
          })
        }
        pending={pending}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${tile.name}”?`}>
        <p className="text-sm text-zinc-400">
          The tile is removed and any running timer is stopped. Time already logged stays in your reports.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteProject(tile.id);
                onError(res.error);
                setConfirmDelete(false);
              })
            }
          >
            Delete
          </Button>
        </div>
      </Modal>
    </article>
  );
}

function EditProjectDialog({
  open,
  onClose,
  tile,
  onSave,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  tile: TileData;
  onSave: (patch: { name: string; color: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(tile.name);
  const [color, setColor] = useState(tile.color);
  useEffect(() => {
    if (open) {
      setName(tile.name);
      setColor(tile.color);
    }
  }, [open, tile.name, tile.color]);

  return (
    <Modal open={open} onClose={onClose} title="Edit project">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, color });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} autoFocus />
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending || !name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

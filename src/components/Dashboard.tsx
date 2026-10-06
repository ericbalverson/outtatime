"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createProject, reorderProjects, startTimer, stopAllTimers, stopTimer } from "@/app/actions";
import type { TileData } from "@/lib/dashboard";
import { formatClock, formatHM, fmtDate } from "@/lib/time";
import { EntriesDialog } from "./EntriesDialog";
import { NewInstanceDialog } from "./NewInstanceDialog";
import { ProjectTile } from "./ProjectTile";
import { ReportDialog } from "./ReportDialog";
import { Button, inputClass } from "./ui";
import { FIT_GAP, useFitGrid } from "./useFitGrid";
import { useNow } from "./useNow";

const FIT_KEY = "outtatime:fit";

type Props = {
  tiles: TileData[];
  weekStart: string;
  weekEnd: string;
  serverNow: number;
  timezone: string;
  instance: { id: string; name: string; startedAt: string };
};

export function Dashboard({ tiles, weekStart, weekEnd, serverNow, timezone, instance }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Optimistic running state so Start/Stop respond instantly; cleared when fresh server data arrives.
  const [optimistic, setOptimistic] = useState<Record<string, string | null>>({});
  useEffect(() => setOptimistic({}), [tiles]);

  const view = useMemo(
    () => tiles.map((t) => (t.id in optimistic ? { ...t, runningSince: optimistic[t.id] } : t)),
    [tiles, optimistic],
  );
  const anyRunning = view.some((t) => t.runningSince);
  const now = useNow(serverNow, anyRunning);

  // Keep other browsers/devices in sync: refresh on focus and every 30s.
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const id = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  const wsMs = Date.parse(weekStart);
  const weMs = Date.parse(weekEnd);
  const live = view.map((t) => {
    const since = t.runningSince ? Date.parse(t.runningSince) : null;
    const runMs = since ? Math.max(0, now - since) : 0;
    const runWeekMs = since ? Math.max(0, Math.min(now, weMs) - Math.max(since, wsMs)) : 0;
    return { ...t, totalMs: t.closedMs + runMs, weekMs: t.closedWeekMs + runWeekMs, runMs };
  });
  const masterMs = live.reduce((a, t) => a + t.totalMs, 0);
  const masterWeekMs = live.reduce((a, t) => a + t.weekMs, 0);
  const runningCount = live.filter((t) => t.runningSince).length;

  useEffect(() => {
    document.title = runningCount ? `${formatClock(masterMs)} · OuttaTime` : "OuttaTime";
  }, [masterMs, runningCount]);

  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.error);
      if (res.error) setOptimistic({});
    });

  const toggle = (id: string, running: boolean) => {
    setOptimistic((o) => ({ ...o, [id]: running ? null : new Date().toISOString() }));
    run(() => (running ? stopTimer(id) : startTimer(id)));
  };

  const move = (id: string, dir: -1 | 1) => {
    const ids = tiles.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderProjects(ids));
  };

  const [newName, setNewName] = useState("");
  const [adding, startAdding] = useTransition();
  const [entriesFor, setEntriesFor] = useState<TileData | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [instanceOpen, setInstanceOpen] = useState(false);

  // "Fit to screen": size the tile grid so every project is visible without scrolling.
  const [fit, setFit] = useState(false);
  useEffect(() => {
    try {
      setFit(localStorage.getItem(FIT_KEY) === "1");
    } catch {}
  }, []);
  const toggleFit = () =>
    setFit((f) => {
      try {
        localStorage.setItem(FIT_KEY, f ? "0" : "1");
      } catch {}
      return !f;
    });
  const gridRef = useRef<HTMLDivElement>(null);
  const fitLayout = useFitGrid(gridRef, live.length, fit);

  return (
    <div data-fit={fit || undefined} className={fit ? "flex h-[calc(100dvh-6.5rem-1px)] flex-col gap-4 sm:h-[calc(100dvh-7.5rem-1px)]" : "space-y-6"}>
      {/* Master clock */}
      <section
        className={`relative shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 ${
          fit ? "px-5 py-4" : "p-5 sm:p-7"
        }`}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className={`relative flex sm:items-end sm:justify-between ${fit ? "items-end justify-between gap-3" : "flex-col gap-5 sm:flex-row"}`}>
          <div>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-medium uppercase tracking-widest text-zinc-500">
              Master clock
              {runningCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {runningCount} running
                </span>
              )}
            </div>
            <div
              suppressHydrationWarning
              className={`font-mono font-semibold tracking-tight text-zinc-50 tabular ${fit ? "mt-1 text-3xl sm:text-5xl" : "mt-2 text-5xl sm:text-7xl"}`}
            >
              {formatClock(masterMs)}
            </div>
            <div className={`text-sm text-zinc-400 ${fit ? "mt-1 hidden sm:block" : "mt-2"}`}>
              {instance.name} · since {fmtDate(instance.startedAt, timezone)}
            </div>
          </div>
          <div className={`flex sm:text-right ${fit ? "gap-4 text-right" : "gap-6"}`}>
            <div>
              <div className="whitespace-nowrap text-xs uppercase tracking-wider text-zinc-500">This week</div>
              <div suppressHydrationWarning className="mt-1 whitespace-nowrap font-mono text-2xl text-zinc-100 tabular">
                {formatHM(masterWeekMs)}
              </div>
            </div>
            <div className={fit ? "hidden sm:block" : undefined}>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Projects</div>
              <div className="mt-1 font-mono text-2xl text-zinc-100 tabular">{tiles.length}</div>
            </div>
          </div>
        </div>
        {runningCount > 1 && !fit && (
          <p className="relative mt-4 text-xs text-zinc-500">
            With several timers running, the master clock adds them together, so it can move faster than real time.
          </p>
        )}
      </section>

      {/* Toolbar */}
      <section className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            startAdding(async () => {
              const res = await createProject(name);
              setError(res.error);
              if (!res.error) setNewName("");
            });
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name"
            maxLength={80}
            className={inputClass}
          />
          <Button variant="primary" disabled={adding || !newName.trim()} className="shrink-0">
            + Add project
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {runningCount > 0 && (
            <Button
              onClick={() => {
                setOptimistic(Object.fromEntries(tiles.map((t) => [t.id, null])));
                run(stopAllTimers);
              }}
            >
              Stop all
            </Button>
          )}
          <Button onClick={() => setReportOpen(true)}>Generate report</Button>
          <Button onClick={() => setInstanceOpen(true)}>New instance</Button>
          <Button
            onClick={toggleFit}
            aria-pressed={fit}
            title={fit ? "Back to normal layout" : "Resize tiles so all projects fit on one screen"}
            aria-label="Fit to screen"
            className={fit ? "!border-blue-500 !bg-blue-500/15 !text-blue-200" : ""}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {fit ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </svg>
            <span className={fit ? "hidden sm:inline" : undefined}>Fit to screen</span>
          </Button>
        </div>
      </section>

      {error && <p className="shrink-0 rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">{error}</p>}

      {/* Tiles */}
      {live.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <p className="text-zinc-300">No projects yet.</p>
          <p className="mt-1 text-sm text-zinc-500">Add your first project above to start tracking time.</p>
        </div>
      ) : (
        <div ref={gridRef} className={fit ? "min-h-0 flex-1 overflow-y-auto" : undefined}>
          <section
            className={fit ? "grid" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}
            style={
              fit && fitLayout
                ? { gap: FIT_GAP, gridTemplateColumns: `repeat(${fitLayout.cols}, minmax(0, 1fr))`, gridAutoRows: fitLayout.rowH }
                : undefined
            }
          >
            {live.map((t, i) => (
              <ProjectTile
                key={t.id}
                tile={t}
                totalMs={t.totalMs}
                weekMs={t.weekMs}
                runMs={t.runMs}
                share={masterMs > 0 ? (t.totalMs / masterMs) * 100 : 0}
                isFirst={i === 0}
                isLast={i === live.length - 1}
                onToggle={() => toggle(t.id, !!t.runningSince)}
                onEntries={() => setEntriesFor(t)}
                onMove={(dir) => move(t.id, dir)}
                onError={setError}
                fit={fit && !!fitLayout}
              />
            ))}
          </section>
        </div>
      )}

      <EntriesDialog project={entriesFor} timezone={timezone} onClose={() => setEntriesFor(null)} />
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} instanceName={instance.name} />
      <NewInstanceDialog
        open={instanceOpen}
        onClose={() => setInstanceOpen(false)}
        instanceName={instance.name}
        projectCount={tiles.length}
      />
    </div>
  );
}

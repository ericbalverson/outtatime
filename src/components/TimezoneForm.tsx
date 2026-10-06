"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { setTimezone } from "@/app/actions";

export function TimezoneForm({ current, submitLabel, next }: { current?: string | null; submitLabel: string; next?: string }) {
  const router = useRouter();
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const [tz, setTz] = useState(current ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!current) setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [current]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          const res = await setTimezone(tz);
          if (res.error) return setError(res.error);
          setError(undefined);
          setSaved(true);
          if (next) router.push(next);
          else router.refresh();
        });
      }}
    >
      <select
        value={tz}
        onChange={(e) => setTz(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
      >
        {!zones.includes(tz) && tz && <option value={tz}>{tz}</option>}
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={pending || !tz}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {saved && !next && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </form>
  );
}

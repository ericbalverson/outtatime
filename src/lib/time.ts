import { DateTime, IANAZone } from "luxon";

export const HOUR = 3_600_000;

export function isValidTimezone(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

/** 3725000 -> "01:02:05". Hours grow past 99 as needed. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 3725000 -> "1h 02m" */
export function formatHM(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Decimal hours rounded to 2 places, for spreadsheets. */
export function toHours(ms: number): number {
  return Math.round((ms / HOUR) * 100) / 100;
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

/** Monday 00:00 of the week containing `date`, in `tz`. */
export function weekStart(date: Date, tz: string): DateTime {
  // Luxon weeks are ISO weeks (Monday start) unless locale weeks are requested.
  return DateTime.fromJSDate(date, { zone: tz }).startOf("week");
}

export function weekBounds(date: Date, tz: string): { start: DateTime; end: DateTime } {
  const start = weekStart(date, tz);
  return { start, end: start.plus({ weeks: 1 }) };
}

/** Milliseconds of [start, end) that fall inside [from, to). */
export function overlapMs(start: number, end: number, from: number, to: number): number {
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

/**
 * Split an interval at Monday-midnight boundaries in `tz`.
 * Returns one segment per week touched, keyed by the week's start (ISO date).
 */
export function splitByWeek(start: number, end: number, tz: string) {
  const segments: { weekKey: string; weekStartMs: number; ms: number }[] = [];
  let cursor = weekStart(new Date(start), tz);
  while (cursor.toMillis() < end) {
    const next = cursor.plus({ weeks: 1 });
    const ms = overlapMs(start, end, cursor.toMillis(), next.toMillis());
    if (ms > 0) segments.push({ weekKey: cursor.toISODate()!, weekStartMs: cursor.toMillis(), ms });
    cursor = next;
  }
  return segments;
}

/** "2026-10-06T14:03" style value for <input type="datetime-local"> in `tz`. */
export function toLocalInput(date: Date | string, tz: string): string {
  return DateTime.fromJSDate(new Date(date), { zone: tz }).toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Parse a datetime-local value as wall-clock time in `tz`. */
export function fromLocalInput(value: string, tz: string): Date | null {
  const dt = DateTime.fromISO(value, { zone: tz });
  return dt.isValid ? dt.toJSDate() : null;
}

export function fmtDateTime(iso: string | Date, tz: string): string {
  return DateTime.fromJSDate(new Date(iso), { zone: tz }).toFormat("ccc LLL d, yyyy h:mm:ss a");
}

export function fmtDate(iso: string | Date, tz: string): string {
  return DateTime.fromJSDate(new Date(iso), { zone: tz }).toFormat("LLL d, yyyy");
}

export function fmtWeekRange(weekStartIso: string, tz: string): string {
  const start = DateTime.fromISO(weekStartIso, { zone: tz });
  const end = start.plus({ days: 6 });
  const sameYear = start.year === end.year;
  return `${start.toFormat(sameYear ? "LLL d" : "LLL d, yyyy")} – ${end.toFormat("LLL d, yyyy")}`;
}

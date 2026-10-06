/**
 * Shape of a frozen report snapshot (stored as JSON in report.data).
 * Bump `version` if this shape changes so old reports can still be rendered.
 */

export type SummaryRow = {
  projectId: string;
  name: string;
  color: string;
  deleted: boolean;
  ms: number;
  /** Share of this summary's total, 0–100. */
  pct: number;
};

export type Summary = {
  totalMs: number;
  rows: SummaryRow[];
};

export type ReportEntry = {
  start: string; // ISO (UTC)
  end: string; // ISO (UTC); report generation time if `running`
  ms: number;
  running: boolean;
};

export type ReportProject = {
  id: string;
  name: string;
  color: string;
  deleted: boolean;
  instanceName: string;
  totalMs: number;
  entries: ReportEntry[];
};

export type ReportData = {
  version: 1;
  generatedAt: string;
  timezone: string;
  user: { name: string | null; email: string | null };
  /** "week" = this week only; "all" = every week in the total basis. */
  range: "week" | "all";
  /** What "total time worked" covers. */
  totalBasis: "instance" | "all";
  instanceName: string | null;
  currentWeek: { start: string; end: string }; // ISO dates (Mon, Sun)
  thisWeek: Summary;
  total: Summary;
  /** Newest week first. */
  weeks: { weekStart: string; summary: Summary }[];
  projects: ReportProject[];
};

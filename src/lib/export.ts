"use client";

import { DateTime } from "luxon";
import type { ReportData, Summary } from "./report-types";
import { fmtDateTime, fmtWeekRange, formatClock, formatHM, toHours } from "./time";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(title: string) {
  return title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "report";
}

export function describe(d: ReportData) {
  return {
    period: d.range === "week" ? `This week only (${fmtWeekRange(d.currentWeek.start, d.timezone)})` : "Full report",
    basis: d.totalBasis === "instance" ? `Current instance${d.instanceName ? ` (${d.instanceName})` : ""}` : "All time",
    generated: fmtDateTime(d.generatedAt, d.timezone),
  };
}

const localTime = (iso: string, tz: string) => DateTime.fromISO(iso, { zone: tz }).toFormat("yyyy-LL-dd HH:mm:ss");

// ---------------------------------------------------------------------------
// CSV: one row per time entry, ready for spreadsheets.
// ---------------------------------------------------------------------------

export function exportCsv(d: ReportData, title: string) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    ["Project", "Instance", "Start", "Stop", "Duration (h:mm:ss)", "Hours", "Status", "Timezone"],
  ];
  for (const p of d.projects) {
    for (const e of p.entries) {
      rows.push([
        p.name + (p.deleted ? " (deleted)" : ""),
        p.instanceName,
        localTime(e.start, d.timezone),
        e.running ? "" : localTime(e.end, d.timezone),
        formatClock(e.ms),
        toHours(e.ms),
        e.running ? "Running" : "Stopped",
        d.timezone,
      ]);
    }
  }
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${slug(title)}.csv`);
}

// ---------------------------------------------------------------------------
// Excel: Summary, Weekly, Entries sheets.
// ---------------------------------------------------------------------------

export async function exportXlsx(d: ReportData, title: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OuttaTime";
  const info = describe(d);
  const bold = { bold: true };

  const summary = wb.addWorksheet("Summary");
  summary.columns = [{ width: 34 }, { width: 14 }, { width: 12 }, { width: 12 }];
  summary.addRow([title]).font = { bold: true, size: 14 };
  summary.addRow(["Generated", info.generated]);
  summary.addRow(["Timezone", d.timezone]);
  summary.addRow(["Period", info.period]);
  summary.addRow(["Total covers", info.basis]);
  const addSummary = (label: string, s: Summary) => {
    summary.addRow([]);
    summary.addRow([label]).font = { bold: true, size: 12 };
    summary.addRow(["Project", "Time", "Hours", "Percent"]).font = bold;
    for (const r of s.rows) summary.addRow([r.name + (r.deleted ? " (deleted)" : ""), formatHM(r.ms), toHours(r.ms), r.pct / 100]);
    summary.addRow(["Total", formatHM(s.totalMs), toHours(s.totalMs), s.totalMs ? 1 : 0]).font = bold;
  };
  addSummary(`This week (${fmtWeekRange(d.currentWeek.start, d.timezone)})`, d.thisWeek);
  addSummary("Total time worked", d.total);
  summary.getColumn(4).numFmt = "0.0%";

  const weekly = wb.addWorksheet("Weekly");
  weekly.columns = [{ width: 28 }, { width: 34 }, { width: 14 }, { width: 12 }, { width: 12 }];
  weekly.addRow(["Week", "Project", "Time", "Hours", "Percent"]).font = bold;
  for (const w of d.weeks) {
    for (const r of w.summary.rows) {
      weekly.addRow([fmtWeekRange(w.weekStart, d.timezone), r.name, formatHM(r.ms), toHours(r.ms), r.pct / 100]);
    }
    weekly.addRow([fmtWeekRange(w.weekStart, d.timezone), "Week total", formatHM(w.summary.totalMs), toHours(w.summary.totalMs), 1]).font = bold;
  }
  weekly.getColumn(5).numFmt = "0.0%";

  const entries = wb.addWorksheet("Entries");
  entries.columns = [{ width: 30 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 10 }, { width: 10 }];
  entries.addRow(["Project", "Instance", "Start", "Stop", "Duration", "Hours", "Status"]).font = bold;
  for (const p of d.projects) {
    for (const e of p.entries) {
      entries.addRow([
        p.name + (p.deleted ? " (deleted)" : ""),
        p.instanceName,
        localTime(e.start, d.timezone),
        e.running ? "" : localTime(e.end, d.timezone),
        formatClock(e.ms),
        toHours(e.ms),
        e.running ? "Running" : "Stopped",
      ]);
    }
  }
  for (const ws of [summary, weekly, entries]) ws.views = [{ state: "frozen", ySplit: ws === summary ? 0 : 1 }];

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${slug(title)}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function exportPdf(d: ReportData, title: string) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const info = describe(d);
  const margin = 40;
  const accent: [number, number, number] = [37, 99, 235];
  const head = { fillColor: [24, 24, 27] as [number, number, number], textColor: 255, fontStyle: "bold" as const };
  let y = margin;

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const heading = (text: string, size = 13) => {
    if (y > 700) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(20);
    doc.text(text, margin, y);
    y += 8;
  };
  const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

  doc.setFillColor(...accent).rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20);
  doc.text(title, margin, (y += 14));
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(90);
  y += 18;
  for (const line of [
    `Generated ${info.generated} (${d.timezone})`,
    `Period: ${info.period}`,
    `Total covers: ${info.basis}`,
    d.user.email ? `User: ${d.user.name ? `${d.user.name} · ` : ""}${d.user.email}` : "",
  ].filter(Boolean)) {
    doc.text(line, margin, y);
    y += 13;
  }
  y += 10;

  const summaryTable = (label: string, s: Summary) => {
    heading(`${label} — ${formatHM(s.totalMs)}`);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["", "Project", "Time", "Hours", "%"]],
      body: s.rows.map((r) => ["", r.name + (r.deleted ? " (deleted)" : ""), formatHM(r.ms), toHours(r.ms).toFixed(2), `${r.pct.toFixed(1)}%`]),
      foot: [["", "Total", formatHM(s.totalMs), toHours(s.totalMs).toFixed(2), s.totalMs ? "100%" : "—"]],
      headStyles: head,
      footStyles: { fillColor: [244, 244, 245], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 9.5, cellPadding: 5 },
      columnStyles: { 0: { cellWidth: 12 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      didDrawCell: (c) => {
        if (c.section === "body" && c.column.index === 0) {
          doc.setFillColor(...hex(s.rows[c.row.index].color));
          doc.circle(c.cell.x + 7, c.cell.y + c.cell.height / 2, 3, "F");
        }
      },
    });
    y = lastY() + 26;
  };

  summaryTable(`This week (${fmtWeekRange(d.currentWeek.start, d.timezone)})`, d.thisWeek);
  summaryTable("Total time worked", d.total);

  if (d.weeks.length) {
    heading("Work weeks");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Week (Mon–Sun)", "Project", "Time", "%"]],
      body: d.weeks.flatMap((w) => [
        ...w.summary.rows.map((r, i) => [i === 0 ? fmtWeekRange(w.weekStart, d.timezone) : "", r.name, formatHM(r.ms), `${r.pct.toFixed(1)}%`]),
        [{ content: "", styles: {} }, { content: "Week total", styles: { fontStyle: "bold" } }, { content: formatHM(w.summary.totalMs), styles: { fontStyle: "bold" } }, ""],
      ]),
      headStyles: head,
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = lastY() + 26;
  }

  heading("Detailed time log");
  for (const p of d.projects) {
    if (!p.entries.length) continue;
    y += 6;
    heading(`${p.name}${p.deleted ? " (deleted)" : ""} — ${formatHM(p.totalMs)}`, 11);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Started", "Stopped", "Duration"]],
      body: p.entries.map((e) => [fmtDateTime(e.start, d.timezone), e.running ? "Running" : fmtDateTime(e.end, d.timezone), formatClock(e.ms)]),
      headStyles: { ...head, fillColor: hex(p.color), textColor: 20 },
      styles: { fontSize: 8.5, cellPadding: 4 },
      columnStyles: { 2: { halign: "right", font: "courier" } },
    });
    y = lastY() + 16;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
    doc.text(`OuttaTime · ${title} · Page ${i} of ${pages}`, margin, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`${slug(title)}.pdf`);
}

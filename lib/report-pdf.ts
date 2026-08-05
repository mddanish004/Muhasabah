import { jsPDF } from "jspdf";

type TrendPoint = { date: string; completionRate: number };

type CategoryRow = {
  categoryId: string;
  categoryName: string;
  color: string;
  assigned: number;
  completed: number;
  completionRate: number;
};

type NotableDay = { date: string; assigned: number; completed: number; completionRate: number };

type ReportPdfData = {
  title: string;
  rangeLabel: string;
  summary: {
    totals: { assigned: number; completed: number };
    overallCompletionRate: number;
    currentStreak: number;
  };
  scores: { productivityScore: number };
  trend: TrendPoint[];
  categories: CategoryRow[];
  notableDays: { best: NotableDay[]; missed: NotableDay[] };
};

function stampStamp(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function generateReportPdf(data: ReportPdfData, rangeSlug: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 20;

  const now = new Date();
  const stamp = now.toLocaleString();

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 10) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text(data.title, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${stamp}`, margin, y);
  doc.text(`Range: ${data.rangeLabel}`, pageWidth - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── KPI row ──
  const kpis = [
    { label: "Total tasks", value: String(data.summary.totals.assigned) },
    { label: "Completed", value: String(data.summary.totals.completed) },
    { label: "Completion", value: `${data.summary.overallCompletionRate}%` },
    {
      label: "Current streak",
      value: `${data.summary.currentStreak} day${data.summary.currentStreak === 1 ? "" : "s"}`,
    },
    { label: "Productivity score", value: String(Math.round(data.scores.productivityScore)) },
  ];
  const boxW = (pageWidth - margin * 2 - 4 * 4) / 5;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (boxW + 4);
    doc.setDrawColor(200);
    doc.roundedRect(x, y, boxW, 22, 1.5, 1.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(kpi.value, x + 3, y + 16);
  });
  doc.setFont("helvetica", "normal");
  y += 30;

  // ── Completion trend chart ──
  ensureSpace(80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("Completion Trend", margin, y);
  y += 4;
  const plotLeft = margin;
  const plotRight = pageWidth - margin;
  const plotTop = y + 8;
  const plotBottom = plotTop + 55;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.setDrawColor(220);
  for (const pct of [0, 25, 50, 75, 100]) {
    const gy = plotBottom - (pct / 100) * (plotBottom - plotTop);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.text(`${pct}%`, plotLeft - 1, gy + 2, { align: "right" });
  }
  const points = data.trend;
  if (points.length > 0) {
    const n = points.length;
    const xFor = (i: number) =>
      plotLeft + (n === 1 ? (plotRight - plotLeft) / 2 : (i / (n - 1)) * (plotRight - plotLeft));
    const yFor = (rate: number) =>
      plotBottom - (Math.min(100, Math.max(0, rate)) / 100) * (plotBottom - plotTop);
    doc.setDrawColor(76, 222, 128);
    doc.setLineWidth(0.6);
    for (let i = 0; i < n - 1; i += 1) {
      doc.line(xFor(i), yFor(points[i].completionRate), xFor(i + 1), yFor(points[i + 1].completionRate));
    }
    if (n === 1) {
      doc.circle(xFor(0), yFor(points[0].completionRate), 0.8, "F");
    }
    doc.setLineWidth(0.2);
    doc.setTextColor(140);
    for (const idx of [0, Math.floor((n - 1) / 2), n - 1]) {
      doc.text(
        points[idx].date.slice(5),
        xFor(idx),
        plotBottom + 4,
        { align: idx === 0 ? "left" : idx === n - 1 ? "right" : "center" },
      );
    }
  } else {
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text("No trend data for this range.", plotLeft, plotTop + 4);
  }
  y = plotBottom + 10;

  // ── Category breakdown table ──
  ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("Category Breakdown", margin, y);
  y += 5;
  const colName = 120;
  const colAssigned = 148;
  const colCompleted = 168;
  const colRate = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text("CATEGORY", margin, y);
  doc.text("ASSIGNED", colAssigned, y, { align: "right" });
  doc.text("COMPLETED", colCompleted, y, { align: "right" });
  doc.text("RATE", colRate, y, { align: "right" });
  y += 2.5;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  for (const cat of data.categories) {
    const nameLines = doc.splitTextToSize(cat.categoryName, colName - margin);
    const rowHeight = nameLines.length * 4 + 2;
    ensureSpace(rowHeight + 4);
    doc.setFontSize(9);
    doc.text(nameLines, margin, y + 3);
    doc.setFont("helvetica", "bold");
    doc.text(String(cat.assigned), colAssigned, y + 3, { align: "right" });
    doc.text(String(cat.completed), colCompleted, y + 3, { align: "right" });
    doc.text(`${cat.completionRate}%`, colRate, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowHeight;
  }
  y += 4;

  // ── Notable days ──
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("Notable Days", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const notableRows: Array<{ text: string; muted: boolean }> = [];
  if (data.notableDays.best.length === 0 && data.notableDays.missed.length === 0) {
    notableRows.push({ text: "No days with scheduled tasks in this range.", muted: true });
  }
  for (const day of data.notableDays.best) {
    notableRows.push({
      text: `${dateLabel(day.date)} · ${day.completionRate}% completion (${day.completed}/${day.assigned})`,
      muted: false,
    });
  }
  for (const day of data.notableDays.missed) {
    notableRows.push({
      text: `${dateLabel(day.date)} · missed day (0/${day.assigned} completed)`,
      muted: true,
    });
  }
  for (const row of notableRows) {
    doc.setTextColor(row.muted ? 140 : 30);
    doc.text(row.text, margin, y);
    y += 5;
  }

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.text(
    `Generated by Self Tasks Tracking Dashboard on ${stamp}.`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" },
  );

  doc.save(`report_${rangeSlug}_${stampStamp(now)}.pdf`);
}

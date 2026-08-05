import { NextRequest } from "next/server";

import { fetchReport } from "@/lib/data";
import { requireApiSession } from "@/lib/http";

function dateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const customFrom = request.nextUrl.searchParams.get("from") ?? undefined;
  const customTo = request.nextUrl.searchParams.get("to") ?? undefined;
  const report = await fetchReport(range, customFrom, customTo);
  const rows = [
    ["id", "title", "category", "priority", "tags", "createdAt", "dueDate", "completedAt", "estimatedDuration", "actualDuration", "notes"],
    ...report.tasks.map((task) => [
      task.id,
      task.title,
      task.category.name,
      task.priority ?? "",
      task.tags.map((tag) => tag.tag.name).join("|"),
      task.createdAt.toISOString(),
      task.dueDate?.toISOString() ?? "",
      task.completedAt?.toISOString() ?? "",
      `${task.estimatedDurationMinutes ?? ""}`,
      `${task.actualDurationMinutes ?? ""}`,
      task.notes ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tasks_${range}_${dateStamp(new Date())}.csv"`,
    },
  });
}

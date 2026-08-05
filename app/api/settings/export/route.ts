import { exportData } from "@/lib/data";
import { requireApiSession } from "@/lib/http";

function dateStamp(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export async function GET() {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const data = await exportData();
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="muhasabah-backup_${dateStamp(new Date())}.json"`,
    },
  });
}

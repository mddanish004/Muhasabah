import { fetchDashboard } from "@/lib/data";
import { ok, requireApiSession } from "@/lib/http";

export async function GET() {
  const session = await requireApiSession();
  if (!session.ok) return session.response;
  return ok(await fetchDashboard());
}

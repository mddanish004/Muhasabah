import { NextRequest } from "next/server";

import { fetchCalendarMonth } from "@/lib/data";
import { ok, requireApiSession } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  return ok(await fetchCalendarMonth(year, month));
}

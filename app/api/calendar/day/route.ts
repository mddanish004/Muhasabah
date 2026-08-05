import { NextRequest } from "next/server";

import { fetchCalendarDay } from "@/lib/data";
import { ok, requireApiSession } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const date = request.nextUrl.searchParams.get("date")!;
  return ok(await fetchCalendarDay(date));
}

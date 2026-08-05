import { NextRequest } from "next/server";

import { fetchReport } from "@/lib/data";
import { ok, requireApiSession } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const customFrom = request.nextUrl.searchParams.get("from") ?? undefined;
  const customTo = request.nextUrl.searchParams.get("to") ?? undefined;
  return ok(await fetchReport(range, customFrom, customTo));
}

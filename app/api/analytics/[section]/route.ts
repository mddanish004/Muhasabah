import { NextRequest } from "next/server";

import { fetchAnalytics } from "@/lib/data";
import { error, ok, parseList, requireApiSession } from "@/lib/http";

type RouteContext = { params: Promise<{ section: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { section } = await context.params;
  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const categoryIds = parseList(request.nextUrl.searchParams.get("category"));
  const data = await fetchAnalytics(section, range, categoryIds);
  if (!data) return error("Unknown analytics section", 404);
  return ok(data);
}

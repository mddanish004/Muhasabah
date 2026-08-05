import { NextRequest } from "next/server";

import { restoreTask } from "@/lib/data";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const task = await restoreTask(id);
  if (!task) return error("Restore snapshot not found", 404);
  return ok(task);
}

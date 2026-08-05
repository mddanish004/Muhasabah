import { NextRequest } from "next/server";

import { importData } from "@/lib/data";
import { ok, requireApiSession, requireCsrf } from "@/lib/http";

export async function POST(request: NextRequest) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;
  await importData(await request.json());
  return ok({ success: true });
}

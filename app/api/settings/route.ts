import { NextRequest } from "next/server";

import { getAdminConfig } from "@/lib/auth";
import { fetchSettings } from "@/lib/data";
import { db } from "@/lib/db";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";
import { settingsSchema } from "@/lib/validation/settings";

export async function GET() {
  const session = await requireApiSession();
  if (!session.ok) return session.response;
  return ok(await fetchSettings());
}

export async function PATCH(request: NextRequest) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const admin = await getAdminConfig();
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid settings", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }
  const updated = await db.admin.update({ where: { id: admin.id }, data: parsed.data });
  return ok(updated);
}

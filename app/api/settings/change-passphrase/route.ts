import { NextRequest } from "next/server";

import { getAdminConfig, hashPassphrase, verifyPassphrase } from "@/lib/auth";
import { db } from "@/lib/db";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";
import { passphraseSchema } from "@/lib/validation/settings";

export async function POST(request: NextRequest) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const parsed = passphraseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid passphrase payload", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }

  const admin = await getAdminConfig();
  const valid = await verifyPassphrase(admin.passphraseHash, parsed.data.currentPassphrase);
  if (!valid) return error("Current passphrase is incorrect", 400, { currentPassphrase: "Current passphrase is incorrect" });

  await db.admin.update({
    where: { id: admin.id },
    data: { passphraseHash: await hashPassphrase(parsed.data.newPassphrase) },
  });
  return ok({ success: true });
}

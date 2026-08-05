import { NextRequest } from "next/server";

import { authenticate, issueSession } from "@/lib/auth";
import { error, ok, rateLimit } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (rateLimit(request, 5, 15 * 60 * 1000)) {
    return error("Too many login attempts. Try again later.", 429);
  }

  const body = (await request.json()) as { passphrase?: string };
  if (!body.passphrase) {
    return error("Passphrase is required", 400, { passphrase: "Passphrase is required" });
  }

  const admin = await authenticate(body.passphrase);
  if (!admin) {
    return error("Invalid passphrase", 401, { passphrase: "Invalid passphrase" });
  }

  await issueSession(admin.id);
  return ok({ authenticated: true });
}

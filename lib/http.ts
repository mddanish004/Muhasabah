import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

type ErrorFields = Record<string, string>;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function error(message: string, status = 400, fields?: ErrorFields, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: { message, ...(fields ? { fields } : {}), ...(extra ?? {}) } },
    { status },
  );
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, response: error("Unauthorized", 401) };
  }
  return { ok: true as const, session };
}

export function requireCsrf(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;

  if (request.headers.get("x-requested-with") !== "self-tasks-dashboard") {
    return error("Invalid request origin", 403);
  }

  return null;
}

const attempts = new Map<string, number[]>();

export function rateLimit(request: NextRequest, limit: number, windowMs: number) {
  const key = request.headers.get("x-forwarded-for") ?? "local";
  const now = Date.now();
  const existing = attempts.get(key) ?? [];
  const filtered = existing.filter((timestamp) => now - timestamp < windowMs);
  filtered.push(now);
  attempts.set(key, filtered);

  return filtered.length > limit;
}

export function parseList(value: string | null) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

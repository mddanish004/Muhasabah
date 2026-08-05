import { NextRequest } from "next/server";
import { RecurrenceFrequency } from "@prisma/client";

import { createTask, getTasks } from "@/lib/data";
import { created, error, ok, parseList, requireApiSession, requireCsrf } from "@/lib/http";
import { taskSchema } from "@/lib/validation/task";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const filters = {
    categoryIds: parseList(request.nextUrl.searchParams.get("category")),
    status: (request.nextUrl.searchParams.get("status") as "all" | "incomplete" | "completed" | null) ?? undefined,
    priority: parseList(request.nextUrl.searchParams.get("priority")),
    search: request.nextUrl.searchParams.get("search") ?? undefined,
  };
  const tasks = await getTasks(filters);
  return ok({ items: tasks, total: tasks.length, page: 1, pageSize: tasks.length });
}

export async function POST(request: NextRequest) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid task", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }
  const payload = parsed.data;
  const task = await createTask({
    ...payload,
    dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    recurrence: payload.recurrence
      ? {
          ...payload.recurrence,
          frequency: payload.recurrence.frequency as RecurrenceFrequency,
        }
      : undefined,
  });
  return created(task);
}

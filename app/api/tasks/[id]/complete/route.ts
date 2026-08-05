import { NextRequest } from "next/server";
import { ActivityEventType } from "@prisma/client";

import { db } from "@/lib/db";
import { parseDateKey, toLocalDate } from "@/lib/date";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";
import { completeTaskSchema } from "@/lib/validation/task";
import { getAdminConfig } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const parsed = completeTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid completion payload", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }

  const admin = await getAdminConfig();
  const completionDate =
    parsed.data.completed && parsed.data.completionDate
      ? toLocalDate(parseDateKey(parsed.data.completionDate, admin.timezone), admin.timezone)
      : parsed.data.completed
        ? new Date()
        : null;

  const task = await db.task.update({
    where: { id },
    data: {
      completedAt: completionDate,
      actualDurationMinutes: parsed.data.actualDurationMinutes ?? undefined,
    },
  });

  await db.activityLogEntry.create({
    data: {
      eventType: parsed.data.completed ? ActivityEventType.TASK_COMPLETED : ActivityEventType.TASK_UNCOMPLETED,
      entityId: id,
      entitySnapshot: task,
    },
  });

  return ok(task);
}

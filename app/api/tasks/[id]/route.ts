import { NextRequest } from "next/server";

import { deleteTask, getTaskById, updateTask } from "@/lib/data";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";
import { taskSchema } from "@/lib/validation/task";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const task = await getTaskById(id);
  if (!task) return error("Not found", 404);
  return ok(task);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const parsed = taskSchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid task", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }
  const payload = parsed.data;
  const task = await updateTask(
    id,
    {
      title: payload.title,
      description: payload.description,
      ...(payload.categoryId ? { category: { connect: { id: payload.categoryId } } } : {}),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      priority: payload.priority ?? undefined,
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
      actualDurationMinutes: payload.actualDurationMinutes,
      notes: payload.notes,
      completedAt: payload.completedAt ? new Date(payload.completedAt) : payload.completedAt === null ? null : undefined,
      isBackfilled: payload.isBackfilled,
    },
    payload.tags,
  );
  return ok(task);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const task = await deleteTask(id);
  return ok(task);
}

import { NextRequest } from "next/server";

import { deleteCategory, getCategoryById, getTasks, updateCategory } from "@/lib/data";
import { error, ok, requireApiSession, requireCsrf } from "@/lib/http";
import { categorySchema } from "@/lib/validation/category";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const category = await getCategoryById(id);
  if (!category) return error("Not found", 404);
  const tasks = await getTasks({ categoryIds: [id] });
  return ok({ ...category, tasks });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const parsed = categorySchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid category", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }
  const category = await updateCategory(id, parsed.data);
  return ok(category);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const cascade = request.nextUrl.searchParams.get("cascade") === "true";
  const result = await deleteCategory(id, cascade);
  if (!result.deleted) {
    return error("Cascade confirmation required", 409, undefined, { taskCount: result.taskCount });
  }
  return ok(result);
}

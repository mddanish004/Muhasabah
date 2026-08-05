import { NextRequest } from "next/server";

import { createCategory, getAllCategories, getTasks } from "@/lib/data";
import { created, error, ok, parseList, requireApiSession, requireCsrf } from "@/lib/http";
import { categorySchema } from "@/lib/validation/category";
import { buildAssignedVsCompleted, buildStreaks } from "@/lib/analytics/core";
import { getAdminConfig } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
  const categories = await getAllCategories(includeArchived);
  const admin = await getAdminConfig();
  const tasks = await getTasks({
    categoryIds: parseList(request.nextUrl.searchParams.get("category")),
  });
  const comparison = buildAssignedVsCompleted(tasks, categories, new Date("2020-01-01"), new Date(), admin.timezone).categories;
  const streaks = buildStreaks(tasks, categories, new Date("2020-01-01"), new Date(), admin.timezone);
  const withStats = categories.map((category) => {
    const stats = comparison.find((item) => item.categoryId === category.id);
    const categoryStreak = streaks.categoryStreaks.find(
      (item) => item.categoryId === category.id,
    );
    return {
      ...category,
      stats: {
        totalTasks: stats?.assigned ?? 0,
        completedTasks: stats?.completed ?? 0,
        completionRate: stats?.completionRate ?? 0,
        currentStreak: categoryStreak?.current ?? 0,
        longestStreak: categoryStreak?.longest ?? 0,
      },
    };
  });
  return ok(withStats);
}

export async function POST(request: NextRequest) {
  const csrf = requireCsrf(request);
  if (csrf) return csrf;
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return error("Invalid category", 400, parsed.error.flatten().fieldErrors as Record<string, string>);
  }

  try {
    const category = await createCategory(parsed.data);
    return created(category);
  } catch {
    return error("Name already in use", 409, { name: "Name already in use" });
  }
}

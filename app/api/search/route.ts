import { NextRequest } from "next/server";

import { getAllCategories, getTasks } from "@/lib/data";
import { ok, requireApiSession } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session.ok) return session.response;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [categories, tasks] = await Promise.all([
    getAllCategories(true),
    getTasks({ search: q }),
  ]);

  return ok({
    tasks: tasks.slice(0, 6),
    categories: categories.filter((category) => category.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4),
  });
}

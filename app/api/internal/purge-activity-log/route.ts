import { subDays } from "date-fns";

import { db } from "@/lib/db";

function isAuthorized(secret: string | null) {
  return secret && secret === process.env.INTERNAL_JOB_SECRET;
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("x-internal-job-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = subDays(new Date(), 90);
  const result = await db.activityLogEntry.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return Response.json({ data: { deleted: result.count } });
}

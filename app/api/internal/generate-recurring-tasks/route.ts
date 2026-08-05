import { RecurrenceFrequency } from "@prisma/client";

import { getAdminConfig } from "@/lib/auth";
import { createTask } from "@/lib/data";
import { db } from "@/lib/db";
import { getDateKey, parseDateKey, todayKey } from "@/lib/date";

function isAuthorized(secret: string | null) {
  return secret && secret === process.env.INTERNAL_JOB_SECRET;
}

function matchesRule(date: Date, frequency: RecurrenceFrequency, daysOfWeek: number[], dayOfMonth: number | null, intervalDays: number | null) {
  if (frequency === "DAILY") return true;
  if (frequency === "WEEKDAYS") return ![0, 6].includes(date.getDay());
  if (frequency === "WEEKLY") return daysOfWeek.includes(date.getDay());
  if (frequency === "MONTHLY") return dayOfMonth === date.getDate();
  if (frequency === "CUSTOM_INTERVAL") return intervalDays ? date.getDate() % intervalDays === 0 : false;
  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("x-internal-job-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = await getAdminConfig();
  const currentDateKey = todayKey(admin.timezone);
  const today = parseDateKey(currentDateKey, admin.timezone);
  const templates = await db.task.findMany({
    where: { isRecurringTemplate: true, ownedRecurrenceRule: { isActive: true } },
    include: { ownedRecurrenceRule: true, tags: { include: { tag: true } } },
  });

  for (const template of templates) {
    const rule = template.ownedRecurrenceRule;
    if (!rule || !matchesRule(today, rule.frequency, rule.daysOfWeek, rule.dayOfMonth, rule.intervalDays)) continue;

    const existing = await db.task.findFirst({
      where: {
        recurrenceRuleId: rule.id,
        dueDate: parseDateKey(currentDateKey, admin.timezone),
      },
    });
    if (existing) continue;

    await createTask({
      title: template.title,
      description: template.description,
      categoryId: template.categoryId,
      dueDate: parseDateKey(currentDateKey, admin.timezone),
      priority: template.priority,
      estimatedDurationMinutes: template.estimatedDurationMinutes,
      notes: template.notes,
      tags: template.tags.map((tag) => tag.tag.name),
    });
  }

  return Response.json({ data: { success: true, date: getDateKey(today, admin.timezone) } });
}

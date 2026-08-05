import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getTaskById } from "@/lib/data";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await getTaskById(taskId);
  if (!task) notFound();

  return (
    <Card>
      <h1 className="text-xl font-semibold">{task.title}</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{task.category.name}</p>
      <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)]">
        <div>Priority: {task.priority ?? "None"}</div>
        <div>Due: {task.dueDate?.toISOString() ?? "No due date"}</div>
        <div>Completed: {task.completedAt?.toISOString() ?? "Not completed"}</div>
        <div>Description: {task.description ?? "No description"}</div>
        <div>Notes: {task.notes ?? "No notes"}</div>
      </div>
    </Card>
  );
}

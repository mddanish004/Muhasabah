"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { useUiStore } from "@/stores/uiStore";

import { fetchJson } from "./use-api";

// ─── Types ───────────────────────────────────────────────────────────────────

type UpdateTaskVariables = {
  id: string;
  title?: string;
  description?: string | null;
  notes?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  estimatedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  categoryId?: string;
  tags?: string[];
};

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);

  return useMutation({
    mutationFn: (payload: unknown) =>
      fetchJson("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      pushToast({ title: "Task created" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      ]);
    },
  });
}

export function useToggleTaskMutation() {
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);

  return useMutation({
    mutationFn: ({
      id,
      completed,
      actualDurationMinutes,
    }: {
      id: string;
      completed: boolean;
      actualDurationMinutes?: number | null;
    }) =>
      fetchJson(`/api/tasks/${id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ completed, actualDurationMinutes }),
      }),
    onSuccess: async (_data, variables) => {
      pushToast({
        title: variables.completed ? "Task completed" : "Task marked incomplete",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      ]);
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);

  return useMutation<unknown, Error, UpdateTaskVariables>({
    mutationFn: ({ id, ...payload }: UpdateTaskVariables) =>
      fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_data, variables) => {
      pushToast({ title: "Task updated" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.task(variables.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      ]);
    },
    onError: () => {
      pushToast({ title: "Failed to update task", variant: "error" });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);

  return useMutation<unknown, Error, string>({
    mutationFn: (id: string) =>
      fetchJson(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: async (_data, id) => {
      pushToast({
        title: "Task deleted",
        description: "You can undo this within a few seconds.",
        action: {
          label: "Undo",
          onClick: () => {
            void fetchJson(`/api/tasks/${id}/restore`, { method: "POST" }).then(
              async () => {
                pushToast({ title: "Task restored" });
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: queryKeys.tasks({}) }),
                  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
                ]);
              },
            );
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
      ]);
    },
    onError: () => {
      pushToast({ title: "Failed to delete task", variant: "error" });
    },
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useTasksQuery(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () => fetchJson(`/api/tasks?${params.toString()}`),
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchJson("/api/dashboard"),
    staleTime: 60_000,
  });
}

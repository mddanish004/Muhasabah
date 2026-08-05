"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useAnalyticsSection(
  section: string,
  filters: { range: string; categories?: string[] },
) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.categories?.length) params.set("category", filters.categories.join(","));

  return useQuery({
    queryKey: queryKeys.analytics(section, filters),
    queryFn: () => fetchJson(`/api/analytics/${section}?${params.toString()}`),
    staleTime: 5 * 60_000,
  });
}

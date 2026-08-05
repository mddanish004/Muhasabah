"use client";

import type { Category } from "@prisma/client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useCategoriesQuery(includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.categories(includeArchived),
    queryFn: () => fetchJson<Category[]>(`/api/categories?includeArchived=${includeArchived}`),
  });
}

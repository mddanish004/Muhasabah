"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export type SettingsData = {
  timezone: string;
  weekStartsOn: number;
  overloadThreshold: number;
};

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => fetchJson<SettingsData>("/api/settings"),
  });
}

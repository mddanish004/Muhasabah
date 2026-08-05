"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useCalendarDayQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.calendarDay(date),
    queryFn: () => fetchJson(`/api/calendar/day?date=${date}`),
    enabled: Boolean(date),
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { fetchJson } from "./use-api";

export function useCalendarMonthQuery(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.calendarMonth(year, month),
    queryFn: () => fetchJson(`/api/calendar/month?year=${year}&month=${month}`),
  });
}

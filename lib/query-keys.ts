export const queryKeys = {
  dashboard: () => ["dashboard"] as const,
  categories: (includeArchived = false) => ["categories", { includeArchived }] as const,
  category: (id: string) => ["category", id] as const,
  tasks: (filters: Record<string, unknown>) => ["tasks", filters] as const,
  task: (id: string) => ["task", id] as const,
  calendarMonth: (year: number, month: number) => ["calendar", "month", year, month] as const,
  calendarDay: (date: string) => ["calendar", "day", date] as const,
  analytics: (section: string, filters: Record<string, unknown>) => ["analytics", section, filters] as const,
  reports: (filters: Record<string, unknown>) => ["reports", filters] as const,
  settings: () => ["settings"] as const,
  search: (q: string) => ["search", q] as const,
};

import { ReactNode } from "react";

import { DayPanel } from "@/components/calendar/day-panel";
import { CommandPalette } from "@/components/search/command-palette";
import { QuickAddPanel } from "@/components/quick-add/quick-add-panel";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireSession();

  return (
    <>
      <AppShell>{children}</AppShell>
      <CommandPalette />
      <QuickAddPanel />
      <DayPanel />
    </>
  );
}

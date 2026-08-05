"use client";

import { ReactNode, useState } from "react";

import { MobileTabs } from "@/components/layout/mobile-tabs";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex">
        {/* Desktop sidebar — always visible on lg+ */}
        <Sidebar className="hidden lg:flex" />

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70"
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <Sidebar
              className="relative z-10 flex w-72 shadow-2xl"
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        )}

        {/* Main content area */}
        <div className="min-w-0 flex-1">
          <TopBar onMobileMenuToggle={() => setMobileMenuOpen((prev) => !prev)} />
          <main className="container-shell pb-24 lg:pb-10">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabs />
    </div>
  );
}

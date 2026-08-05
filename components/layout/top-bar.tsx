"use client";

import Link from "next/link";
import { LogOut, Menu, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/stores/uiStore";

interface TopBarProps {
  onMobileMenuToggle?: () => void;
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const router = useRouter();
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[rgba(10,10,11,0.92)] px-4 py-4 backdrop-blur md:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMobileMenuToggle}
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search bar — hidden on mobile, shown on md+ */}
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="relative hidden flex-1 md:block"
      >
        <Input
          readOnly
          value="Search tasks, categories, actions..."
          className="cursor-pointer pl-10 text-[var(--text-secondary)]"
        />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <Link href="/tasks">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={async () => {
            await fetch("/api/auth/logout", {
              method: "POST",
              headers: { "X-Requested-With": "self-tasks-dashboard" },
            });
            router.push("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

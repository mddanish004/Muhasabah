"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  FileText,
  FolderKanban,
  Home,
  ListTodo,
  MoreHorizontal,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/categories", label: "Categories", icon: FolderKanban },
];

const MORE = [
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-default)] bg-[var(--bg-surface-1)] lg:hidden"
    >
      <div className="flex items-stretch">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition",
                active
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        {/* More (Reports + Settings) */}
        <div ref={moreRef} className="relative flex flex-1">
          <button
            type="button"
            onClick={() => setMoreOpen((prev) => !prev)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={cn(
              "flex w-full flex-col items-center gap-1 py-2.5 text-[10px] transition",
              moreOpen
                ? "text-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>

          {moreOpen && (
            <div
              role="menu"
              className="absolute bottom-full right-0 mb-2 w-40 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-1)] p-1 shadow-[var(--shadow-lg)]"
            >
              {MORE.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition",
                      active
                        ? "bg-[var(--bg-surface-2)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

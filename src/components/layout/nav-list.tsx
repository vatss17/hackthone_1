"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { availableNav, plannedNav } from "@/config/navigation";
import { cn } from "@/lib/utils";

const groupLabel =
  "px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div>
        <h2 className={groupLabel}>Workspace</h2>
        <ul className="flex flex-col gap-0.5">
          {availableNav.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-md border-l-2 px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                      : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className={groupLabel}>Planned modules</h2>
        <ul className="flex flex-col gap-0.5">
          {plannedNav.map((item) => (
            <li
              key={item.id}
              className="flex h-8 items-center px-3 text-sm text-muted-foreground"
            >
              {item.label}
            </li>
          ))}
        </ul>
        <p className="px-3 pt-2 text-xs leading-5 text-muted-foreground">
          Not yet built. Listed to show where the platform is heading.
        </p>
      </div>
    </nav>
  );
}

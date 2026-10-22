"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { availableNav, plannedNav, previewNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

const groupLabel =
  "px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const link = (item: NavItem, preview = false) => {
    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.id}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-md border-l-2 px-3 text-sm font-medium transition-colors",
            active
              ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
              : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
        >
          <span className="truncate">{item.label}</span>
          {preview && <span className="shrink-0 rounded-sm border border-dashed border-input/60 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preview</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div>
        <h2 className={groupLabel}>Workspace</h2>
        <ul className="flex flex-col gap-0.5">{availableNav.map((i) => link(i))}</ul>
      </div>

      {previewNav.length > 0 && (
        <div>
          <h2 className={groupLabel}>Export journey</h2>
          <ul className="flex flex-col gap-0.5">{previewNav.map((i) => link(i, true))}</ul>
          <p className="px-3 pt-2 text-xs leading-5 text-muted-foreground">Previews show what each step will do. Live data is not connected yet.</p>
        </div>
      )}

      {plannedNav.length > 0 && (
        <div>
          <h2 className={groupLabel}>Planned modules</h2>
          <ul className="flex flex-col gap-0.5">
            {plannedNav.map((item) => (
              <li key={item.id} className="flex h-8 items-center px-3 text-sm text-muted-foreground">
                {item.label}
              </li>
            ))}
          </ul>
          <p className="px-3 pt-2 text-xs leading-5 text-muted-foreground">Not yet built.</p>
        </div>
      )}
    </nav>
  );
}

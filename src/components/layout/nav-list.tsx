"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { moreNav, plannedNav, primaryNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

const isActive = (pathname: string, item: NavItem) => (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const moreActive = moreNav.some((i) => isActive(pathname, i));

  const link = (item: NavItem, quiet = false) => {
    const active = isActive(pathname, item);
    return (
      <li key={item.id}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-3 transition-colors",
            quiet ? "h-8 text-[13px]" : "h-10 text-sm font-medium",
            active ? "bg-sidebar-accent text-sidebar-accent-foreground" : quiet ? "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.status === "preview" && <span className="shrink-0 rounded-sm border border-dashed border-input/60 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preview</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">{primaryNav.map((i) => link(i))}</ul>

      <details open={moreActive} className="group px-0">
        <summary className="flex h-8 cursor-pointer list-none items-center justify-between rounded-md px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          All export tools
          <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <ul className="mt-1 flex flex-col gap-0.5">{moreNav.map((i) => link(i, true))}</ul>
      </details>

      {plannedNav.length > 0 && (
        <ul className="flex flex-col">
          {plannedNav.map((item) => (
            <li key={item.id} className="flex h-8 items-center px-3 text-sm text-muted-foreground">
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

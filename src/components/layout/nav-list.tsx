"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Compass, Factory, FlaskConical, Globe2, LayoutDashboard, PackageCheck, Rocket, Sparkles, type LucideIcon } from "lucide-react";
import { plannedNav, primaryNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const ICONS: Record<string, LucideIcon> = { overview: LayoutDashboard, workbench: Sparkles, factory: Factory, opportunities: Compass, world: Globe2, schemefinder: BadgeCheck, workspace: PackageCheck, mission: Rocket, whatif: FlaskConical };

/** The items sit in three work stages, so the rail answers "which part of the job am I in?". */
const STAGES: { label: string; ids: string[] }[] = [
  { label: "Command", ids: ["overview", "workbench"] },
  { label: "Discover", ids: ["factory", "opportunities", "world", "schemefinder"] },
  { label: "Execute", ids: ["workspace", "mission", "whatif"] },
];

/**
 * Where a page belongs in the four-item navigation. Pages reached from a product (compliance, calculator, documents…)
 * keep "My exports" selected, and the catalogue sits under "My factory".
 */
const EXPORT_PATHS = ["/workspace", "/viability", "/feasibility", "/compliance", "/schemes", "/documentation", "/roadmap", "/services"];
const OPPORTUNITY_PATHS = ["/opportunities", "/evidence"];
const FACTORY_PATHS = ["/factories", "/products"];
const START_PATHS = ["/start"];

const isActive = (pathname: string, item: NavItem) => {
  if (item.href === "/") return pathname === "/" || START_PATHS.some((p) => pathname.startsWith(p));
  if (item.id === "workspace" && pathname.startsWith("/schemes/finder")) return false;
  const group = item.id === "workspace" ? EXPORT_PATHS : item.id === "opportunities" ? OPPORTUNITY_PATHS : item.id === "factory" ? FACTORY_PATHS : [item.href];
  return group.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav aria-label={t("Main")} className="flex flex-col gap-5">
      {STAGES.map((stage) => {
        const items = stage.ids.map((id) => primaryNav.find((n) => n.id === id)).filter((n): n is NavItem => !!n);
        return (
          <div key={stage.label}>
            <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">{t(stage.label)}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = ICONS[item.id] ?? LayoutDashboard;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors md:h-10",
                        active ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary" : "text-sidebar-foreground hover:bg-secondary",
                      )}
                    >
                      <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{t(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {plannedNav.length > 0 && (
        <ul className="flex flex-col">
          {plannedNav.map((item) => (
            <li key={item.id} className="flex h-8 items-center px-3 text-sm text-muted-foreground">
              {t(item.label)}
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Popover } from "radix-ui";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n/client";
import { LanguageSelect } from "@/components/layout/language-select";
import { DEPARTMENTS, deptHref, type Department } from "@/lib/landing/departments";
import { cn } from "@/lib/utils";

type Tr = ReturnType<typeof useT>;

/** One department in the desktop bar: a button that opens a small panel listing its sub-services. */
function DeptMenu({ dept, open, onOpenChange, t }: { dept: Department; open: boolean; onOpenChange: (o: boolean) => void; t: Tr }) {
  const panelId = `menu-${dept.id}`;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-controls={panelId}
          aria-haspopup="true"
          onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); onOpenChange(true); } }}
          className={cn("inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[15px] text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", open && "bg-secondary text-foreground")}
        >
          {t(dept.title)}
          <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </Popover.Trigger>
      <Popover.Content id={panelId} align="start" sideOffset={8} collisionPadding={16} aria-label={t(dept.title)} className="atlas-pop z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-card p-2 shadow-xl outline-none">
        <p className="px-3 pb-1 pt-2 text-[13px] text-muted-foreground">{t(dept.summary)}</p>
        <ul>
          {dept.services.map((s) => (
            <li key={s.title}>
              <Link href={deptHref(dept.id, s.anchor)} onClick={() => onOpenChange(false)} className="block min-w-0 rounded-md px-3 py-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                <span className="block text-sm font-medium">{t(s.title)}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{t(s.line)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}

/** Phone menu: a sheet with each department as an expandable section. */
function MobileMenu({ t }: { t: Tr }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label={t("Open menu")}><Menu aria-hidden /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(22rem,100vw)] gap-0 overflow-y-auto p-0 data-[side=right]:w-[min(22rem,100vw)]">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{t("Services by department")}</SheetTitle>
          <SheetDescription className="sr-only">{t("Choose a department to see its services.")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("Departments")} className="px-2 py-2">
          {DEPARTMENTS.map((d) => {
            const isOpen = expanded === d.id;
            const id = `m-${d.id}`;
            return (
              <div key={d.id} className="border-b last:border-0">
                <button type="button" aria-expanded={isOpen} aria-controls={id} onClick={() => setExpanded(isOpen ? null : d.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                  <span className="min-w-0">{t(d.title)}</span>
                  <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <ul id={id} className="pb-2">
                    {d.services.map((s) => (
                      <li key={s.title}>
                        <SheetClose asChild>
                          <Link href={deptHref(d.id, s.anchor)} className="block min-w-0 rounded-md px-3 py-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                            <span className="block text-sm font-medium">{t(s.title)}</span>
                            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{t(s.line)}</span>
                          </Link>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          <SheetClose asChild><Button asChild variant="outline"><Link href="/login">{t("Sign in")}</Link></Button></SheetClose>
          <SheetClose asChild><Button asChild><Link href="/signup">{t("Create account")}</Link></Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Header for the pages a visitor can open without an account. Sign-up is always one click away. */
export function PublicHeader() {
  const t = useT();
  const pathname = usePathname();
  const [opened, setOpened] = useState<{ id: string; path: string } | null>(null);
  // A dropdown opened on another page counts as closed, so a route change closes it without an effect.
  const openId = opened && opened.path === pathname ? opened.id : null;
  const setOpenId = (fn: (cur: string | null) => string | null) => setOpened((cur) => { const id = fn(cur && cur.path === pathname ? cur.id : null); return id ? { id, path: pathname } : null; });

  useEffect(() => {
    const close = () => setOpened(null);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);

  const change = (id: string, o: boolean) => setOpenId((cur: string | null) => (o ? id : cur === id ? null : cur));

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 text-foreground sm:px-6">
        <Link href="/" aria-label={t("Atlas, home")} className="shrink-0 rounded-md">
          <Brand className="h-6" />
        </Link>
        <nav aria-label={t("Departments")} className="hidden min-w-0 items-center gap-0.5 xl:flex">
          {DEPARTMENTS.map((d) => (
            <DeptMenu key={d.id} dept={d} t={t} open={openId === d.id} onOpenChange={(o) => change(d.id, o)} />
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSelect />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/login">{t("Sign in")}</Link></Button>
          <Button asChild size="sm"><Link href="/signup">{t("Create account")}</Link></Button>
          <MobileMenu t={t} />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import { Bell, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtlas } from "@/components/atlas/atlas-provider";
import { useActivity, usePlan } from "@/components/atlas/use-atlas-store";
import { INTENT_BY_ID } from "@/lib/atlas/intents";
import { useT } from "@/lib/i18n/client";
import { LanguageSelect } from "@/components/layout/language-select";

/** Search, Atlas AI and notifications in the top bar. Notifications are worked out from what is saved in this browser: nothing is pushed from a server. */
export function HeaderActions() {
  const { openPalette, openCopilot, scope, products } = useAtlas();
  const t = useT();
  const [plan] = usePlan(scope);
  const [log] = useActivity(scope);
  const name = (ref: string) => products.find((p) => p.id === ref)?.name ?? t("A product");

  const open = plan.filter((p) => !p.done);
  const byRef = [...new Set(open.map((p) => p.ref))].map((ref) => ({ ref, count: open.filter((p) => p.ref === ref).length }));
  const waiting = log.filter((a) => a.decision === null && INTENT_BY_ID[a.intent]?.proposesChange).slice(0, 3);
  const total = byRef.length + waiting.length;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={openPalette}
        className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:w-64"
        aria-label={t("Search or ask Atlas")}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden flex-1 text-left md:inline">{t("Search or ask…")}</span>
        <kbd className="hidden rounded border bg-card px-1.5 text-[11px] md:inline">⌘K</kbd>
      </button>
      <Button size="sm" onClick={() => openCopilot()} className="gap-1.5" aria-keyshortcuts="Meta+J Control+J">
        <Sparkles aria-hidden />
        <span className="hidden sm:inline">{t("Atlas AI")}</span>
        <span className="sr-only sm:hidden">{t("Open Atlas AI")}</span>
      </Button>
      <LanguageSelect />
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" size="icon-sm" className="relative" aria-label={total ? `${t("Notifications")}, ${total}` : t("Notifications")}>
            <Bell />
            {total > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-(--brand-teal)" aria-hidden />}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={8} className="atlas-pop z-50 w-80 rounded-lg border bg-card p-1 shadow-xl outline-none">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{t("Notifications")}</p>
            <ul className="flex flex-col">
              {waiting.map((a) => (
                <li key={a.id}>
                  <Link href="/workbench" className="block rounded-md px-3 py-2 text-sm hover:bg-secondary">
                    <span className="font-medium">{t("Waiting for your approval")}</span>
                    <span className="block text-xs text-muted-foreground">{a.title}</span>
                  </Link>
                </li>
              ))}
              {byRef.map((r) => (
                <li key={r.ref}>
                  <Link href={`/mission/${r.ref}`} className="block rounded-md px-3 py-2 text-sm hover:bg-secondary">
                    <span className="font-medium">{r.count === 1 ? t("{count} open task in your plan", { count: r.count }) : t("{count} open tasks in your plan", { count: r.count })}</span>
                    <span className="block text-xs text-muted-foreground">{name(r.ref)}</span>
                  </Link>
                </li>
              ))}
              {total === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{t("Nothing new. Tasks you add with Atlas AI and proposals waiting for you show here.")}</li>}
            </ul>
            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">{t("From this browser only. Atlas has no live market or regulatory feed yet.")}</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowRight, Box, FileText, Search, Sparkles } from "lucide-react";
import { navigation } from "@/config/navigation";
import { INTENTS } from "@/lib/atlas/intents";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type Item = { id: string; group: "Ask Atlas AI" | "Go to" | "Products"; label: string; hint: string; run: () => void; icon: "ai" | "page" | "product" };

/** Search every module, every product and every Atlas AI tool from one box. Cmd/Ctrl+K anywhere in the app. */
export function CommandPalette({ open, onOpenChange, products, onAsk }: { open: boolean; onOpenChange: (v: boolean) => void; products: { id: string; name: string }[]; onAsk: (prompt: string) => void }) {
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const has = (...s: string[]) => !term || s.some((x) => x.toLowerCase().includes(term));
    const ask: Item[] = INTENTS.filter((i) => has(i.prompt, t(i.prompt), i.does, t(i.does))).map((i) => ({ id: `ai:${i.id}`, group: "Ask Atlas AI", label: t(i.prompt), hint: t("Runs a tool"), run: () => onAsk(t(i.prompt)), icon: "ai" }));
    const free: Item[] = term && ask.length === 0 ? [{ id: "ai:free", group: "Ask Atlas AI", label: t("Ask Atlas: “{query}”", { query: q.trim() }), hint: t("Atlas picks a tool"), run: () => onAsk(q.trim()), icon: "ai" }] : [];
    const pages: Item[] = navigation
      .filter((n) => n.status !== "planned" && has(n.label, t(n.label), n.description, t(n.description)))
      .map((n) => ({ id: `page:${n.id}`, group: "Go to", label: n.label, hint: t(n.description), run: () => go(n.href), icon: "page" }));
    const prods: Item[] = products
      .filter((p) => has(p.name))
      .slice(0, 8)
      .flatMap((p) => [
        { id: `prod:${p.id}`, group: "Products" as const, label: p.name, hint: t("Export workspace"), run: () => go(`/workspace/${p.id}`), icon: "product" as const },
        ...(term ? [{ id: `mission:${p.id}`, group: "Products" as const, label: t("{name} · Mission Control", { name: p.name }), hint: t("Journey map and task board"), run: () => go(`/mission/${p.id}`), icon: "product" as const }] : []),
      ]);
    return [...free, ...ask.slice(0, term ? 8 : 4), ...pages.slice(0, term ? 10 : 8), ...prods];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, products, onAsk, t]);

  const current = Math.min(active, Math.max(0, items.length - 1));
  const groups = ["Ask Atlas AI", "Go to", "Products"] as const;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setQ("");
          setActive(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="atlas-fade fixed inset-0 z-50 bg-[#16233f]/30" />
        <Dialog.Content aria-describedby={undefined} className="atlas-pop fixed inset-x-3 top-[12vh] z-50 mx-auto flex max-h-[70vh] max-w-xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl outline-none">
          <Dialog.Title className="sr-only">{t("Search Atlas")}</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  items[current]?.run();
                }
              }}
              role="combobox"
              aria-expanded="true"
              aria-controls="atlas-palette-list"
              aria-activedescendant={items[current] ? `cp-${items[current].id}` : undefined}
              placeholder={t("Search pages and products, or ask Atlas AI…")}
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div id="atlas-palette-list" role="listbox" aria-label={t("Results")} className="overflow-y-auto p-2">
            {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Nothing matches.")}</p>}
            {groups.map((g) => {
              const list = items.filter((i) => i.group === g);
              if (!list.length) return null;
              return (
                <div key={g} role="group" aria-label={t(g)} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground">{t(g)}</p>
                  {list.map((it) => {
                    const idx = items.indexOf(it);
                    const Icon = it.icon === "ai" ? Sparkles : it.icon === "product" ? Box : FileText;
                    return (
                      <div
                        key={it.id}
                        id={`cp-${it.id}`}
                        role="option"
                        aria-selected={idx === current}
                        onMouseEnter={() => setActive(idx)}
                        onClick={it.run}
                        className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5", idx === current ? "bg-selected" : "")}
                      >
                        <Icon aria-hidden className={cn("size-4 shrink-0", it.icon === "ai" ? "text-(--brand-teal)" : "text-muted-foreground")} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{it.group === "Go to" ? t(it.label) : it.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{it.hint}</span>
                        </span>
                        {idx === current && <ArrowRight aria-hidden className="size-4 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            <kbd className="font-sans">↑↓</kbd> {t("to move")} · <kbd className="font-sans">Enter</kbd> {t("to open")} · <kbd className="font-sans">⌘J</kbd> {t("opens Atlas AI")}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

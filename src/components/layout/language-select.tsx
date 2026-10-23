"use client";

import { Check, Languages } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Language selector. Changing the language only changes what the interface says: forms keep what has been typed (no page
 * reload, only a server refresh), and the stored data is language-independent.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5", className)} aria-label={`${t("Language")}: ${LOCALE_NAMES[locale].native}`}>
          <Languages aria-hidden />
          <span lang={locale} className="hidden sm:inline">{LOCALE_NAMES[locale].native}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="atlas-pop z-50 w-44 rounded-lg border bg-card p-1 shadow-xl outline-none">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{t("Choose language")}</p>
          <ul role="listbox" aria-label={t("Language")}>
            {LOCALES.map((l) => (
              <li key={l} role="option" aria-selected={l === locale}>
                <Popover.Close asChild>
                  <button type="button" lang={l} onClick={() => setLocale(l)} className="flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-secondary">
                    <span>{LOCALE_NAMES[l].native}</span>
                    {l === locale && <Check aria-hidden className="size-4 text-(--brand-teal)" />}
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

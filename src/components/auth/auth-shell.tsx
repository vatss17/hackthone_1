"use client";

import { Brand } from "@/components/layout/brand";
import { useT } from "@/lib/i18n/client";

/**
 * Frame for sign-in, sign-up, recovery and reset. On wide screens a white column carries the wordmark and what the product is
 * (and is not); on phones it collapses to a compact header. The form side stays a single narrow column.
 */
export function AuthShell({ children, width = "26rem" }: { children: React.ReactNode; width?: string }) {
  const t = useT();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r bg-card p-10 text-foreground lg:flex">
        <Brand className="h-7" />
        <div>
          <p className="max-w-xs text-[1.625rem] font-semibold leading-snug tracking-[-0.01em]">{t("Your factory. The world. One intelligent platform.")}</p>
          <ul className="mt-6 max-w-xs space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            <li>{t("Plan India export for finished plastic products, one product at a time.")}</li>
            <li>{t("Every figure says where it comes from: your data, an assumption, or an estimate.")}</li>
            <li>{t("Nothing is filed, sent or approved for you. Documents are drafts to review.")}</li>
          </ul>
        </div>
        <p className="text-[13px] text-muted-foreground">{t("Pre-release build. Use test data only: no real company or customer information.")}</p>
      </aside>

      <div className="flex min-h-screen flex-col lg:min-h-0">
        <header className="flex h-16 items-center border-b bg-card px-4 text-foreground sm:px-6 lg:hidden">
          <Brand />
        </header>
        <main className="mx-auto w-full flex-1 px-4 py-10 sm:py-14 lg:flex lg:flex-col lg:justify-center lg:py-0" style={{ maxWidth: width }}>
          {children}
        </main>
        <footer className="border-t px-4 py-4 text-[13px] text-muted-foreground sm:px-6 lg:hidden">{t("Pre-release build. Use test data only.")}</footer>
      </div>
    </div>
  );
}

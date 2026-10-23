"use client";

import { useT } from "@/lib/i18n/client";

export default function Loading() {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className="space-y-4 motion-safe:animate-pulse" aria-label={t("Loading")}>
      <div className="h-3 w-24 rounded-sm bg-muted" />
      <div className="h-8 w-2/3 max-w-md rounded-sm bg-muted" />
      <div className="h-4 w-full max-w-xl rounded-sm bg-muted" />
      <div className="mt-6 h-40 rounded-lg border bg-card" />
      <div className="h-28 rounded-lg border bg-card" />
      <span className="sr-only">{t("Loading…")}</span>
    </div>
  );
}

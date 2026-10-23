"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export type Crumb = { label: string; href?: string };

/**
 * Page title block. One pattern for every screen: optional breadcrumb trail, the title (28px, weight 600),
 * a short description capped at a readable width, and actions aligned to the right of the title on wide screens.
 * `eyebrow` is kept for older call sites and is shown as the first breadcrumb.
 */
export function PageHeader({
  eyebrow,
  crumbs,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  crumbs?: Crumb[];
  title: string;
  description?: string;
  /** Optional control (for example a link button) shown beside the title on wide screens. */
  action?: React.ReactNode;
}) {
  const t = useT();
  const trail: Crumb[] = crumbs ?? (eyebrow ? [{ label: eyebrow }] : []);
  return (
    <header className="pb-1">
      {trail.length > 0 && (
        <nav aria-label={t("Breadcrumb")} className="mb-2 text-[13px] text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {trail.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {c.href ? (
                  <Link href={c.href} className="underline-offset-4 hover:text-foreground hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={i === trail.length - 1 ? "page" : undefined}>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 max-w-3xl break-words text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.01em]">{title}</h1>
        {action && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{action}</div>}
      </div>
      {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
    </header>
  );
}

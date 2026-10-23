"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/** Grayscale wireframe primitives. Deliberately plain: no brand, no polish. */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{children}</h1>;
}
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
}
export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <p className={cx("text-sm leading-relaxed sm:text-base", muted ? "text-muted-foreground" : "text-foreground")}>{children}</p>;
}

type BtnProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
};
export function Btn({ children, href, onClick, kind = "secondary", disabled, type = "button", small }: BtnProps) {
  const cls = cx(
    "inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    small && "min-h-8 px-3 text-xs",
    kind === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
    kind === "secondary" && "border-input bg-card text-foreground hover:bg-secondary",
    kind === "ghost" && "border-transparent text-primary underline underline-offset-4 hover:bg-secondary",
    disabled && "pointer-events-none opacity-40",
  );
  if (href && !disabled) return <Link href={href} onClick={onClick} className={cls}>{children}</Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Box({ children, className, title, tone }: { children: ReactNode; className?: string; title?: string; tone?: "plain" | "soft" }) {
  return (
    <section className={cx("rounded-lg border bg-card p-4 sm:p-5", tone === "soft" && "bg-mint border-primary/20", className)}>
      {title && <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>}
      {children}
    </section>
  );
}

export function Tag({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className={cx("inline-block rounded-sm border px-2 py-0.5 text-xs font-medium", strong ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
      {children}
    </span>
  );
}

export function Placeholder({ label, h = "h-40" }: { label: string; h?: string }) {
  return (
    <div role="img" aria-label={label} className={cx("flex items-center justify-center rounded border border-dashed border-input bg-muted p-3 text-center text-xs text-muted-foreground", h)}>
      [ {label} ]
    </div>
  );
}

const TONES = {
  info: "border-border bg-secondary",
  warn: "border-(--status-estimate-border) bg-(--status-estimate-bg)",
  error: "border-(--status-missing-border) bg-(--status-missing-bg)",
  empty: "border-dashed border-input bg-card",
} as const;
export function Callout({ tone = "info", title, children, actions }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode; actions?: ReactNode }) {
  const t = useT();
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded border p-4", TONES[tone])}>
      {title && <p className="mb-1 text-sm font-semibold text-foreground">{tone === "error" ? `${t("Problem:")} ` : tone === "warn" ? `${t("Heads up:")} ` : ""}{title}</p>}
      {children && <div className="text-sm leading-relaxed text-foreground">{children}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  const t = useT();
  return (
    <nav aria-label={label} className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("Step {current} of {total}", { current, total: steps.length })}: <span className="text-foreground">{steps[current - 1]}</span>
      </p>
      <div className="flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <div key={s} className={cx("h-1.5 flex-1 rounded-sm border border-input/60", i + 1 <= current ? "bg-primary" : "bg-card")} />
        ))}
      </div>
      <ol className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:flex">
        {steps.map((s, i) => (
          <li key={s} aria-current={i + 1 === current ? "step" : undefined} className={cx(i + 1 === current && "font-semibold text-foreground")}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function StepNav({ onBack, backHref, onNext, nextLabel, nextDisabled, onSkip, skipLabel }: { onBack?: () => void; backHref?: string; onNext?: () => void; nextLabel: string; nextDisabled?: boolean; onSkip?: () => void; skipLabel?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        {(onBack || backHref) && <Btn onClick={onBack} href={backHref}>{t("Back")}</Btn>}
        {onSkip && <Btn kind="ghost" onClick={onSkip}>{skipLabel ?? t("Skip for now")}</Btn>}
      </div>
      <Btn kind="primary" onClick={onNext} disabled={nextDisabled}>{nextLabel}</Btn>
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
export const inputCls = "min-h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export function Choice({ selected, onSelect, title, children, type = "radio" }: { selected: boolean; onSelect: () => void; title: string; children?: ReactNode; type?: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={selected}
      onClick={onSelect}
      className={cx("w-full rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", selected ? "border-primary bg-mint ring-1 ring-primary" : "border-input bg-card hover:bg-secondary")}
    >
      <span className="flex items-start gap-3">
        <span aria-hidden className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center border border-input bg-card text-xs", type === "radio" ? "rounded-full" : "rounded-sm", selected && "border-primary bg-primary text-primary-foreground")}>
          {selected ? "✓" : ""}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {children && <span className="mt-1 block text-sm text-muted-foreground">{children}</span>}
        </span>
      </span>
    </button>
  );
}

export function Disclosure({ title, summary, children, open }: { title: string; summary?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-ring">
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {summary && <span className="block text-xs text-muted-foreground">{summary}</span>}
        </span>
        <span aria-hidden className="text-muted-foreground group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t px-4 py-4 text-sm text-foreground">{children}</div>
    </details>
  );
}

export function Row({ label, value, tag }: { label: string; value: ReactNode; tag?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-sm font-medium text-foreground">{value}{tag && <Tag>{tag}</Tag>}</dd>
    </div>
  );
}

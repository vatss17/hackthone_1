"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SCENARIOS } from "@/lib/ux-preview/data.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Btn } from "./wf.tsx";
import { ReviewerNote } from "./feedback.tsx";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Logo() {
  return <Link href="/ux-preview" className="text-base font-semibold text-foreground">[Logo] ExportEase</Link>;
}

/** Shows which fictional state the reviewer has switched on, with a way out. */
function ScenarioStrip() {
  const { state, set } = usePreview();
  const router = useRouter();
  if (state.scenario === "default") return null;
  const s = SCENARIOS.find((x) => x.key === state.scenario);
  return (
    <div className="border-b border-border bg-muted px-4 py-2 text-xs text-foreground sm:px-6">
      <span className="font-semibold">Reviewing state:</span> {s?.label}.{" "}
      <button className="underline" onClick={() => set({ scenario: "default" })}>Back to normal</button>{" · "}
      <button className="underline" onClick={() => router.push("/ux-preview/states")}>All states</button>
    </div>
  );
}

export function PublicFrame({ screen, children }: { screen: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = [
    ["Sample", "/ux-preview/sample"],
    ["How it works", "/ux-preview/landing#how"],
    ["Pricing & trust", "/ux-preview/landing#trust"],
  ];
  return (
    <div>
      <ScenarioStrip />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-5 text-sm sm:flex">
            {links.map(([l, h]) => <Link key={l} href={h} className="text-foreground hover:underline">{l}</Link>)}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Btn href="/ux-preview/app/home" kind="ghost" small>Sign in</Btn>
            <Btn href="/ux-preview/signup" kind="primary" small>Create account</Btn>
          </div>
          <button className="rounded border border-input px-3 py-2 text-sm sm:hidden" aria-expanded={open} aria-controls="pub-menu" onClick={() => setOpen(!open)}>
            Menu
          </button>
        </div>
        {open && (
          <div id="pub-menu" className="space-y-2 border-t border-border px-4 py-3 sm:hidden">
            {links.map(([l, h]) => <Link key={l} href={h} onClick={() => setOpen(false)} className="block py-2 text-sm">{l}</Link>)}
            <Link href="/ux-preview/app/home" className="block py-2 text-sm">Sign in</Link>
            <Btn href="/ux-preview/signup" kind="primary">Create account</Btn>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
        <ReviewerNote screen={screen} />
      </main>
    </div>
  );
}

const NAV = [
  ["Home", "/ux-preview/app/home"],
  ["My factory", "/ux-preview/app/factory"],
  ["Opportunities", "/ux-preview/app/opportunities"],
  ["My exports", "/ux-preview/app/exports"],
] as const;

export function AppFrame({ screen, children, active }: { screen: string; children: ReactNode; active?: string }) {
  const pathname = usePathname();
  const { state } = usePreview();
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <ScenarioStrip />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {NAV.map(([l, h]) => {
              const on = active ? active === h : pathname === h || pathname.startsWith(`${h}/`);
              return (
                <Link key={l} href={h} aria-current={on ? "page" : undefined} className={cx("rounded px-3 py-2 text-sm", on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary")}>
                  {l}
                </Link>
              );
            })}
          </nav>
          <span className="rounded border border-input px-2 py-1 text-xs text-muted-foreground">Sample Polymers [account]</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {state.scenario === "unsaved" && (
          <div className="mb-6">
            <UnsavedBanner />
          </div>
        )}
        {children}
        <ReviewerNote screen={screen} />
      </main>
      <nav aria-label="Primary (mobile)" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-input bg-card sm:hidden">
        {NAV.map(([l, h]) => {
          const on = active ? active === h : pathname === h || pathname.startsWith(`${h}/`);
          return (
            <Link key={l} href={h} aria-current={on ? "page" : undefined} className={cx("flex min-h-14 items-center justify-center px-1 text-center text-xs", on ? "bg-primary font-semibold text-white" : "text-foreground")}>
              {l}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function UnsavedBanner() {
  const { set } = usePreview();
  const [done, setDone] = useState("");
  return (
    <div role="status" className="rounded border border-l-8 border-primary bg-card p-4 text-sm">
      <p className="font-semibold">You have changes saved only in this browser.</p>
      <p className="mt-1 text-muted-foreground">They are not on our servers and will not appear on your phone or another computer. Download a backup to keep them safe.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn small onClick={() => setDone("Backup downloaded (simulated).")}>Download a backup</Btn>
        <Btn small kind="ghost" onClick={() => set({ scenario: "default" })}>Dismiss</Btn>
        <span role="status" className="text-xs">{done}</span>
      </div>
    </div>
  );
}

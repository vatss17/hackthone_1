"use client";

import Link from "next/link";
import { Bot, GitBranch, Map, SlidersHorizontal } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/landing/hero";
import { SchemesAi } from "@/components/landing/schemes-ai";
import { Services } from "@/components/landing/services";
import { Story } from "@/components/landing/story";
import { TryDemo } from "@/components/landing/try-demo";
import { useT } from "@/lib/i18n/client";

/** The public homepage: the journey in one scroll, a live try-it demo on the real engine, and an honest scope. */
export function Landing() {
  const t = useT();
  const SIGNATURE = [
    { icon: Map, title: t("Export Mission Control"), body: t("Your whole journey on one map: every milestone, what depends on what, and what is blocking you. Click a step to open it.") },
    { icon: GitBranch, title: t("Factory-to-World"), body: t("See how each capability you declare leads to products you could make and the market they would ship to.") },
    { icon: SlidersHorizontal, title: t("What-If Studio"), body: t("Change production cost, freight, quantity or price and watch landed cost and margin recalculate instantly.") },
    { icon: Bot, title: t("AI Action Workbench"), body: t("Atlas AI prepares tasks, document drafts and research summaries. You approve before anything is saved.") },
  ];
  const journey = [t("Factory"), t("Products"), t("Opportunities"), t("Economics"), t("Compliance"), t("Schemes"), t("Documents"), t("AI execution"), t("Export readiness")];
  return (
    <div>
      <Hero />

      <section aria-label={t("Journey at a glance")} className="border-t py-8">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-muted-foreground">
          {journey.map((s, i, a) => (
            <li key={s} className="flex items-center gap-3">
              <span className="font-medium text-foreground">{s}</span>
              {i < a.length - 1 && <span aria-hidden className="text-border">/</span>}
            </li>
          ))}
        </ol>
      </section>

      <Story />
      <TryDemo />
      <Services />
      <SchemesAi />

      <section aria-labelledby="sig-h" className="border-t py-16 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-[15px] font-medium text-brand-teal">{t("Inside the workspace")}</p>
          <h2 id="sig-h" className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{t("Four places where the work actually gets done.")}</h2>
        </div>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          {SIGNATURE.map((f) => (
            <li key={f.title} className="bg-card p-6">
              <f.icon aria-hidden className="size-5 text-brand-teal" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="coverage" aria-labelledby="cov-h" className="scroll-mt-20 border-t py-16 lg:py-24">
        <h2 id="cov-h" className="text-[2rem] font-semibold leading-tight tracking-[-0.02em]">{t("Honest about coverage")}</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          <div className="bg-card p-6">
            <p className="text-[13px] font-medium text-success">{t("Live now")}</p>
            <h3 className="mt-1 text-lg font-semibold">{t("India to the UAE")}</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">{t("Finished plastic products: capability matching, landed cost, screening with AI-researched drafts, documents and the roadmap.")}</p>
          </div>
          <div className="bg-card p-6">
            <p className="text-[13px] font-medium text-muted-foreground">{t("Not yet")}</p>
            <h3 className="mt-1 text-lg font-semibold">{t("More markets and sectors")}</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">{t("The platform is built for many destinations. They open as each one gets its own researched data. None is shown as live before then.")}</p>
          </div>
          <div className="bg-card p-6">
            <p className="text-[13px] font-medium text-warning">{t("Always verified by people")}</p>
            <h3 className="mt-1 text-lg font-semibold">{t("What Atlas never decides")}</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">{t("Tariff rulings, certifications, approvals and filings. Atlas drafts and explains; you and your advisers confirm. No market demand figures are shown without a licensed source.")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:py-16">
        <h2 className="text-[2rem] font-semibold tracking-[-0.02em] sm:text-[2.5rem]">{t("Start with one product.")}</h2>
        <p className="mx-auto mt-3 max-w-md text-lg text-primary-foreground/80">{t("Create your workspace in a few minutes, or try the guided sample first.")}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-card text-foreground hover:bg-secondary"><Link href="/signup">{t("Create your workspace")}</Link></Button>
          <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-hover"><Link href="/sample">{t("Explore the guided sample")}</Link></Button>
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-[13px] text-muted-foreground">
        <div className="text-foreground"><Brand className="h-5" /></div>
        <nav aria-label={t("Footer")} className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="#journey" className="hover:text-foreground">{t("How it works")}</Link>
          <Link href="#try" className="hover:text-foreground">{t("Try it")}</Link>
          <Link href="#schemes-ai" className="hover:text-foreground">{t("Schemes")}</Link>
          <Link href="/sample" className="hover:text-foreground">{t("Guided sample")}</Link>
          <Link href="/login" className="hover:text-foreground">{t("Sign in")}</Link>
        </nav>
        <p className="w-full">{t("Atlas is a working product name. Pre-release build: use test data only. Previews on this page show sample data.")}</p>
      </footer>
    </div>
  );
}

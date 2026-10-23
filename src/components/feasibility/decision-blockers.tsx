"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/workspace/roadmap-board";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { productProvidedFields, summariseAssumptions } from "@/lib/landed-cost/assumptions";
import { useT } from "@/lib/i18n/client";
import { nAssumptions } from "@/lib/opportunities/localize";
import type { Inputs } from "@/lib/landed-cost/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";

/**
 * Leads the feasibility page with what matters before any detail: the one thing to do first and why, the blockers that stop a sound
 * decision (a loss at the person's own numbers comes first), and how many assumptions are still unexamined samples.
 */
export function DecisionBlockers({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const w = useWorkspace({ scope, facts, defaults });
  if (!w.hydrated) return <p className="mt-6 text-sm text-muted-foreground">{t("Loading the decision summary…")}</p>;
  const { roadmap, assessment } = w;
  const sum = summariseAssumptions(assessment, productProvidedFields(facts.product ? { unitsPerCarton: facts.product.unitsPerCarton, cartonWeightKg: facts.product.cartonWeightKg, cartonDims: facts.product.cartonDims } : null));
  const blockers = roadmap.blockers.slice(0, 4);
  const n = roadmap.next;
  return (
    <section aria-labelledby="dec-h" className="mt-6 rounded-lg border bg-card p-5 sm:p-6">
      <h2 id="dec-h" className="text-lg font-medium tracking-tight">
        {t("Before the detail: what to do first")}
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          {n ? (
            <>
              <p className="text-xs font-medium tracking-[0.12em] text-primary">{n.chosenByYou ? t("Your chosen focus") : t("Do this first")}</p>
              <p className="mt-1 text-lg font-medium leading-snug">{t(n.task.title)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(n.reason)}</p>
              <Button asChild className="mt-3 h-10 px-4">
                <Link href={n.task.next.href}>{t(n.task.next.label)}</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Every roadmap task is marked completed. That records progress. It does not mean any requirement is met.")}</p>
          )}
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground">{t("Blockers")}</h3>
            {blockers.length === 0 ? (
              <p className="mt-1 text-muted-foreground">{t("No open blockers.")}</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {blockers.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-2">
                    <Link href={b.next.href} className="underline-offset-4 hover:underline">
                      {t(b.title)}
                    </Link>
                    <StatusPill status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground">{t("Unresolved assumptions")}</h3>
            <p className="mt-1">
              {sum.complete ? t("No sample values left to examine.") : t("{samples} of {total} are still samples.", { samples: sum.samples.length, total: nAssumptions(t, sum.total) })}{" "}
              <Link href={facts.standalone ? "/viability#inputs" : `/viability?product=${facts.ref}#inputs`} className="text-primary underline-offset-4 hover:underline">
                {t("Open the calculator")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

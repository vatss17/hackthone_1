"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Field, Select, SubmitButton } from "@/components/profile/form-bits";
import { Button } from "@/components/ui/button";
import { EVENT, read, subscribe, write } from "@/components/landed-cost/use-assessment";
import { updateProcess } from "@/lib/actions/capabilities";
import { CAPACITY_PERIODS, CAPACITY_UNITS } from "@/lib/capability-validation";
import { PROVENANCE_LABEL, estimateFactory, estimateProcess, formatQuantity, isValidUtilisation, translateEstimateMessage, type Layout } from "@/lib/capacity/available";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface PlannerProcess {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  period: string | null;
}

interface Saved {
  layout: Layout;
  governingId: string | null;
  confirmed: boolean;
  byProcess: Record<string, { util: string; shifts: string; hours: string }>;
}
const EMPTY: Saved = { layout: "unknown", governingId: null, confirmed: false, byProcess: {} };
const keyFor = (scope: string, factoryId: string) => `export-enablement:capacity:v1:${scope}:${factoryId}`;

function parse(raw: string | null): Saved {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<Saved>;
    const layout: Layout = v.layout === "sequential" || v.layout === "parallel" ? v.layout : "unknown";
    const byProcess: Saved["byProcess"] = {};
    for (const [id, p] of Object.entries(v.byProcess ?? {})) byProcess[id] = { util: String(p?.util ?? "").slice(0, 6), shifts: String(p?.shifts ?? "").slice(0, 3), hours: String(p?.hours ?? "").slice(0, 4) };
    return { layout, governingId: typeof v.governingId === "string" ? v.governingId : null, confirmed: v.confirmed === true, byProcess };
  } catch {
    return EMPTY;
  }
}

const Pill = ({ tone, children }: { tone: "reported" | "calculated" | "none"; children: React.ReactNode }) => (
  <span
    className={cn(
      "inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 text-xs font-medium",
      tone === "reported" && "border-(--status-user-border) bg-(--status-user-bg) text-(--status-user-fg)",
      tone === "calculated" && "border-(--status-estimate-border) bg-(--status-estimate-bg) text-(--status-estimate-fg)",
      tone === "none" && "border-(--status-missing-border) bg-(--status-missing-bg) text-(--status-missing-fg)",
    )}
  >
    {children}
  </span>
);

/**
 * Step 4 of the guided setup: capacity by process, current utilisation, and the available capacity that follows.
 * Capacity is saved to the factory record as before. Utilisation, shifts and the confirmation are kept in this browser
 * (there is no place for them in the database yet), so they never change the factory record.
 */
export function CapacityPlanner({ scope, factoryId, isOwner, processes, nextHref }: { scope: string; factoryId: string; isOwner: boolean; processes: PlannerProcess[]; nextHref: string }) {
  const t = useT();
  const fq = (q: { quantity: number; unit: string; period: string }) => formatQuantity(q, t);
  const unitOptions = CAPACITY_UNITS.map((o) => ({ value: o.value, label: t(o.label) }));
  const periodOptions = CAPACITY_PERIODS.map((o) => ({ value: o.value, label: t(o.label) }));
  const key = keyFor(scope, factoryId);
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const saved = useMemo(() => parse(raw), [raw]);
  const update = useCallback(
    (fn: (s: Saved) => Saved) => {
      write(key, JSON.stringify(fn(parse(read(key)))));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  const estimates = processes.map((p) => {
    const u = saved.byProcess[p.id]?.util ?? "";
    const n = u.trim() === "" ? null : Number(u);
    return estimateProcess({ ...p, utilisationPct: n !== null && isValidUtilisation(n) ? n : n === null ? null : -1 });
  });
  const factory = estimateFactory(estimates, saved.layout, saved.governingId);
  const withFigure = estimates.filter((e) => e.available);

  if (processes.length === 0) return <p className="text-sm text-muted-foreground">{t("Add a process in step 2 first, then come back to say how much it can make.")}</p>;

  return (
    <div className="space-y-8">
      <p className="rounded-lg bg-muted px-4 py-3 text-sm" role="note">
        <span className="font-medium">{t("Saved in this browser only.")}</span> {t("The capacity you report is saved to your factory record. Utilisation, the calculated available capacity and your confirmation are kept in this browser for now, and they do not change any opportunity score.")}
      </p>
      <ul className="divide-y rounded-lg border bg-card">
        {processes.map((p, i) => {
          const e = estimates[i];
          const mine = saved.byProcess[p.id] ?? { util: "", shifts: "", hours: "" };
          const set = (patch: Partial<typeof mine>) => update((s) => ({ ...s, confirmed: false, byProcess: { ...s.byProcess, [p.id]: { ...mine, ...patch } } }));
          return (
            <li key={p.id} className="space-y-4 px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-medium">{t(p.label)}</h3>
                {e.reported && <Pill tone="reported">{t(PROVENANCE_LABEL.reported)}: {fq(e.reported)}</Pill>}
              </div>

              {isOwner ? (
                <form action={updateProcess} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="factoryId" value={factoryId} />
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="returnStep" value="4" />
                  <Field id={`q-${p.id}`} name="capacityQuantity" label={t("How much can it make?")} inputMode="decimal" defaultValue={p.quantity ?? ""} placeholder={t("e.g. 180")} autoComplete="off" />
                  <Select id={`u-${p.id}`} name="capacityUnit" label={t("Unit")} options={unitOptions} placeholder={t("Choose…")} defaultValue={p.unit} />
                  <Select id={`p-${p.id}`} name="capacityPeriod" label={t("Per")} options={periodOptions} placeholder={t("Choose…")} defaultValue={p.period} />
                  <SubmitButton variant="outline">{t("Save")}</SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">{e.reported ? fq(e.reported) : t("No capacity reported.")}</p>
              )}

              <div data-autosave className="grid gap-3 sm:grid-cols-3">
                <Field id={`ut-${p.id}`} name="util" label={t("Already committed (%)")} inputMode="decimal" value={mine.util} onChange={(ev) => set({ util: ev.target.value })} placeholder={t("e.g. 65")} autoComplete="off" hint={t("Share of that capacity already in use.")} />
                <Field id={`sh-${p.id}`} name="shifts" label={t("Shifts per day (optional)")} inputMode="numeric" value={mine.shifts} onChange={(ev) => set({ shifts: ev.target.value })} autoComplete="off" />
                <Field id={`hr-${p.id}`} name="hours" label={t("Hours per shift (optional)")} inputMode="decimal" value={mine.hours} onChange={(ev) => set({ hours: ev.target.value })} autoComplete="off" />
              </div>

              {e.available ? (
                <p className="flex flex-wrap items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm">
                  <span className="font-medium">{t("Available: {amount}", { amount: fq(e.available) })}</span>
                  <Pill tone="calculated">{t(PROVENANCE_LABEL.calculated)}</Pill>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t(e.missing)}</p>
              )}
            </li>
          );
        })}
      </ul>

      {processes.length > 1 && (
        <fieldset className="rounded-lg border bg-card px-4 py-5 sm:px-6">
          <legend className="px-1 text-base font-medium">{t("How do these processes fit together?")}</legend>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("We never add up stages of one line, because a line only makes as much as its slowest stage. Tell us which describes you.")}</p>
          <div className="mt-3 grid gap-2 text-sm">
            {(
              [
                ["sequential", t("One production line: material goes through these stages in turn")],
                ["parallel", t("Separate lines: each process makes its own products independently")],
                ["unknown", t("I am not sure yet")],
              ] as [Layout, string][]
            ).map(([v, label]) => (
              <label key={v} className="flex items-start gap-2">
                <input type="radio" name="layout" className="mt-1 accent-primary" checked={saved.layout === v} onChange={() => update((s) => ({ ...s, layout: v, confirmed: false }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {saved.layout === "sequential" && withFigure.length > 1 && (
            <label className="mt-4 grid max-w-sm gap-1.5 text-sm">
              <span className="font-medium">{t("Which stage limits your output (the bottleneck)?")}</span>
              <select
                className="h-11 rounded-md border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-10 md:text-sm"
                value={saved.governingId ?? ""}
                onChange={(ev) => update((s) => ({ ...s, governingId: ev.target.value || null, confirmed: false }))}
              >
                <option value="">{t("Choose…")}</option>
                {withFigure.map((e) => (
                  <option key={e.id} value={e.id}>
                    {t(e.label)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
      )}

      <section aria-labelledby="fw-h" className="rounded-lg bg-mint px-5 py-6 sm:px-8">
        <p className="text-xs font-medium tracking-[0.14em] text-primary">{t("Your available capacity")}</p>
        <h3 id="fw-h" className="mt-2 text-xl font-semibold tracking-tight">
          {factory.value ? fq(factory.value) : withFigure.length === 1 && processes.length === 1 ? fq(withFigure[0].available!) : t("Not worked out yet")}
        </h3>
        {(factory.value || (withFigure.length === 1 && processes.length === 1)) && <p className="mt-1 text-sm text-foreground/80">{factory.governing ? t("{estimate}, from the capacity and utilisation you reported, limited by {label}. Not verified.", { estimate: t(PROVENANCE_LABEL.calculated), label: factory.governing.label }) : t("{estimate}, from the capacity and utilisation you reported. Not verified.", { estimate: t(PROVENANCE_LABEL.calculated) })}</p>}
        {factory.ask && !(withFigure.length === 1 && processes.length === 1) && <p className="mt-2 max-w-2xl text-sm text-foreground/80">{translateEstimateMessage(factory.ask, t)}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="h-10 bg-card px-4" disabled={withFigure.length === 0} onClick={() => update((s) => ({ ...s, confirmed: !s.confirmed }))}>
            {saved.confirmed ? t("Confirmed. Undo") : t("These look right: confirm")}
          </Button>
          {saved.confirmed && <span className="text-sm text-foreground/80">{t("Saved in this browser. Opportunity suggestions do not use it yet.")}</span>}
        </div>
        <p className="mt-4 max-w-2xl text-xs text-foreground/70">{t("Shifts and hours are kept for context only and are not part of the calculation. No machine speeds or cycle times are assumed.")}</p>
      </section>

      <p className="text-sm">
        <a href={nextHref} className="font-medium text-primary underline-offset-4 hover:underline">
          {t("Continue to review →")}
        </a>
      </p>
    </div>
  );
}

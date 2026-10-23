import type { Metadata } from "next";
import { FormAssist } from "@/components/ai-input/form-assist";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ActionButton, Disclosure, Field, Flash, Select, SubmitButton } from "@/components/profile/form-bits";
import { UnsavedGuard } from "@/components/unsaved-guard";
import { CapacityPlanner } from "@/components/factories/capacity-planner";
import { getT } from "@/lib/i18n/server";
import { requireOrganization } from "@/lib/organization";
import { getActiveFactory } from "@/lib/factories";
import { isUuid } from "@/lib/factory-validation";
import { capacityText, getFactoryProfile, getReferenceData, listProducts, loadEngineInput } from "@/lib/capabilities";
import { CAPACITY_PERIODS, CAPACITY_UNITS, RATING_UNITS } from "@/lib/capability-validation";
import { RATING_UNIT_LABELS, FIT_LABEL, discover } from "@/lib/opportunities/engine";
import { addMachine, addMaterial, addProcess, archiveMachine, linkFactory, removeMaterial, removeProcess, saveFactoryWideCapacity } from "@/lib/actions/capabilities";

export const metadata: Metadata = { title: "Describe your factory · Atlas" };
export const instant = false;

type T = (source: string, vars?: Record<string, string | number>) => string;

const stepsFor = (t: T) =>
  [
    { n: 1, short: t("Products"), title: t("What do you manufacture?"), lead: t("Start with the finished products you make today. The platform matches them against your machines to suggest what else you could make.") },
    { n: 2, short: t("Processes"), title: t("Which processes and machinery do you use?"), lead: t("Name the ways you shape plastic and the machines behind them. Ratings are optional, but they sharpen the suggestions.") },
    { n: 3, short: t("Materials"), title: t("Which materials do you work with?"), lead: t("The polymers you can process today. Add your own entry for blends or recycled grades.") },
    { n: 4, short: t("Capacity"), title: t("How much can you make, and how much is already spoken for?"), lead: t("Give capacity by process and what is already committed. We work out what is available, and ask you to confirm it.") },
    { n: 5, short: t("Review"), title: t("Your manufacturing profile"), lead: t("A quick look at what you have told us, and what the platform can already suggest.") },
  ] as const;

const termsFor = (t: T): [string, string][] => [
  [t("Injection moulding"), t("Melted plastic is pushed into a steel mould. Used for lids, crates, containers, caps and fittings.")],
  [t("Extrusion"), t("Plastic is pushed continuously through a die. Used for pipes, tubing, sheets and profiles.")],
  [t("Clamp force"), t("How hard an injection press holds the mould shut, in tonnes. A bigger press makes bigger parts.")],
];

export default async function FactorySetupPage({ params, searchParams }: PageProps<"/factories/[id]/setup">) {
  const { t } = await getT();
  const STEPS = stepsFor(t);
  const { organization } = await requireOrganization();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const factory = await getActiveFactory(organization.id, id);
  if (!factory) notFound();
  const [profile, refs, products, sp] = await Promise.all([getFactoryProfile(organization.id, id), getReferenceData(), listProducts(organization.id), searchParams]);
  const isOwner = organization.role === "owner";

  const hasCapacity = profile.processes.some((p) => p.capacityQuantity !== null);
  const firstOpen = profile.products.length === 0 ? 1 : profile.processes.length === 0 || profile.machines.length === 0 ? 2 : profile.materials.length === 0 ? 3 : !hasCapacity ? 4 : 5;
  const asked = typeof sp.step === "string" && /^[1-5]$/.test(sp.step) ? Number(sp.step) : null;
  const step = asked ?? firstOpen;
  const meta = STEPS[step - 1];
  const here = `/factories/${id}/setup`;
  const hidden = (
    <>
      <input type="hidden" name="factoryId" value={id} />
      <input type="hidden" name="returnStep" value={String(step)} />
    </>
  );
  const hiddenIds = (extra: Record<string, string>) => ({ ...extra, factoryId: id, returnStep: String(step) });

  const usedProcessIds = new Set(profile.processes.map((p) => p.processId));
  const usedMaterialIds = new Set(profile.materials.map((m) => m.materialId));
  const processOptions = refs.processes.filter((r) => !usedProcessIds.has(r.id)).map((r) => ({ value: r.id, label: t(r.name) }));
  const materialOptions = refs.materials.filter((r) => !usedMaterialIds.has(r.id)).map((r) => ({ value: r.id, label: `${r.code} · ${t(r.name)}` }));
  const unitOptions = CAPACITY_UNITS.map((o) => ({ value: o.value, label: t(o.label) }));
  const periodOptions = CAPACITY_PERIODS.map((o) => ({ value: o.value, label: t(o.label) }));
  const ratingUnitOptions = RATING_UNITS.map((o) => ({ value: o.value, label: t(o.label) }));
  const ratingText = (m: { ratingValue: number | null; ratingUnit: string | null }) => (m.ratingValue !== null ? `${m.ratingValue} ${t(RATING_UNIT_LABELS[m.ratingUnit ?? ""] ?? m.ratingUnit ?? "")}` : t("no rating"));
  const linkedIds = new Set(profile.products.map((p) => p.productId));
  const unlinked = products.filter((p) => !linkedIds.has(p.id));

  const found = step === 5 ? discover((await loadEngineInput(organization.id)).input) : null;

  return (
    <>
      <PageHeader eyebrow={`${factory.name} · ${t("Describe your factory")}`} title={meta.title} description={meta.lead} />

      <nav aria-label={t("Setup steps")} className="mt-6">
        <ol className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Link
                href={`${here}?step=${s.n}`}
                aria-current={s.n === step ? "step" : undefined}
                className={s.n === step ? "inline-flex h-8 items-center rounded-md bg-mint px-3 font-medium" : "inline-flex h-8 items-center rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"}
              >
                <span className="mr-1.5 tnum text-xs text-primary">{s.n}</span>
                {s.short}
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-label={t("Step {step} of 5", { step })}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("Step {step} of 5. Everything here can be changed later, and you can skip any step.", { step })}</p>
      </nav>
      <Flash params={sp} />
      <UnsavedGuard />

      <div className="mt-8 space-y-8">
        {/* ------------------------------------------------ 1 products */}
        {step === 1 && (
          <>
            {profile.products.length > 0 ? (
              <ul className="divide-y rounded-lg border bg-card">
                {profile.products.map((p) => (
                  <li key={p.linkId} className="px-4 py-3.5 sm:px-5">
                    <p className="font-medium">{p.name}</p>
                    {p.category && <p className="text-sm text-muted-foreground">{p.category}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed bg-card px-5 py-6 text-sm text-muted-foreground">{t("No products are linked to this factory yet. Import your catalogue, or add a product by hand. For example: “Stackable crate 40L, HDPE”.")}</p>
            )}
            {isOwner && unlinked.length > 0 && (
              <div>
                <h2 className="text-sm font-medium">{t("Already in your catalogue, not yet linked to this factory")}</h2>
                <ul className="mt-2 divide-y rounded-lg border bg-card">
                  {unlinked.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                      <span className="text-sm">{p.name}</span>
                      <form action={linkFactory}>
                        {hidden}
                        <input type="hidden" name="productId" value={p.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {t("Made here")}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isOwner && (
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-10">
                  <Link href="/products/import">{t("Import a catalogue")}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-10">
                  <Link href={`/products/new?factory=${id}`}>{t("Add one product")}</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------ 2 processes and machines */}
        {step === 2 && (
          <>
            <details className="rounded-lg border bg-card px-4 py-3 text-sm sm:px-5">
              <summary className="cursor-pointer font-medium">{t("New to these terms?")}</summary>
              <dl className="mt-3 grid gap-3">
                {termsFor(t).map(([term, d]) => (
                  <div key={term}>
                    <dt className="font-medium">{term}</dt>
                    <dd className="text-muted-foreground">{d}</dd>
                  </div>
                ))}
              </dl>
            </details>

            <section aria-labelledby="proc-h">
              <h2 id="proc-h" className="text-base font-medium">
                {t("Processes")}
              </h2>
              {profile.processes.length > 0 && (
                <ul className="mt-2 divide-y rounded-lg border bg-card">
                  {profile.processes.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                      <span className="text-sm font-medium">{t(p.label)}</span>
                      {isOwner && (
                        <ActionButton action={removeProcess} hidden={hiddenIds({ id: p.id })} label={t("Remove {name}", { name: p.label })}>
                          {t("Remove")}
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && (
                <Disclosure summary={profile.processes.length ? t("Add another process") : t("Add a process")}>
                  <form action={addProcess} className="grid gap-4">
                    {hidden}
                    <FormAssist kind="process" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select id="np-process" name="process" label={t("Process")} options={processOptions} placeholder={t("Choose from the list…")} hint={t("Or leave this empty and name your own.")} />
                      <Field id="np-custom" name="customName" label={t("Your own process name")} maxLength={100} autoComplete="off" hint={t("Only if it is not in the list.")} />
                    </div>
                    <div>
                      <SubmitButton>{t("Add process")}</SubmitButton>
                    </div>
                  </form>
                </Disclosure>
              )}
            </section>

            <section aria-labelledby="mach-h">
              <h2 id="mach-h" className="text-base font-medium">
                {t("Machinery")}
              </h2>
              {profile.machines.length > 0 && (
                <ul className="mt-2 divide-y rounded-lg border bg-card">
                  {profile.machines.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{m.name}</span> <span className="text-muted-foreground">× {m.quantity}</span>
                        <p className="text-muted-foreground">{[m.processName ? t(m.processName) : null, ratingText(m)].filter(Boolean).join(" · ")}</p>
                      </div>
                      {isOwner && (
                        <ActionButton action={archiveMachine} hidden={hiddenIds({ id: m.id })} label={t("Remove {name}", { name: m.name })}>
                          {t("Remove")}
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && (
                <Disclosure summary={profile.machines.length ? t("Add another machine") : t("Add a machine")}>
                  <form action={addMachine} className="grid gap-4">
                    {hidden}
                    <FormAssist kind="machine" />
                    <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
                      <Field id="nm-name" name="name" label={t("Machine name")} required maxLength={200} placeholder={t("e.g. Injection press 150T")} autoComplete="off" />
                      <Field id="nm-qty" name="quantity" label={t("How many?")} inputMode="numeric" defaultValue={1} required autoComplete="off" />
                    </div>
                    <Select id="nm-proc" name="process" label={t("Process it runs")} options={refs.processes.map((r) => ({ value: r.id, label: t(r.name) }))} placeholder={t("Not sure")} />
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-primary">{t("Rating and details (optional)")}</summary>
                      <div className="mt-3 grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                          <Field id="nm-rv" name="ratingValue" label={t("Rating")} inputMode="decimal" placeholder={t("e.g. 150")} autoComplete="off" />
                          <Select id="nm-ru" name="ratingUnit" label={t("Rating unit")} options={ratingUnitOptions} placeholder={t("Choose when you give a rating")} hint={t("For a press, clamp force in tonnes is usually on the nameplate.")} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field id="nm-make" name="make" label={t("Make")} maxLength={100} autoComplete="off" />
                          <Field id="nm-model" name="model" label={t("Model")} maxLength={100} autoComplete="off" />
                          <Field id="nm-year" name="yearInstalled" label={t("Year installed")} inputMode="numeric" maxLength={4} autoComplete="off" />
                        </div>
                      </div>
                    </details>
                    <div>
                      <SubmitButton>{t("Add machine")}</SubmitButton>
                    </div>
                  </form>
                </Disclosure>
              )}
            </section>
          </>
        )}

        {/* ------------------------------------------------ 3 materials */}
        {step === 3 && (
          <>
            {profile.materials.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {profile.materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-1 rounded-lg border bg-card py-1 pl-3 pr-1 text-sm">
                    <span>{m.code ?? m.label}</span>
                    {isOwner && (
                      <ActionButton action={removeMaterial} hidden={hiddenIds({ id: m.id })} label={t("Remove {name}", { name: m.label })}>
                        ×
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed bg-card px-5 py-6 text-sm text-muted-foreground">{t("No materials yet. Most plastic converters start with PP (polypropylene) and HDPE (high-density polyethylene).")}</p>
            )}
            {isOwner && (
              <form action={addMaterial} className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5">
                {hidden}
                <FormAssist kind="material" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select id="nmat-ref" name="material" label={t("Material")} options={materialOptions} placeholder={t("Choose from the list…")} hint={t("Or leave this empty and name your own.")} />
                  <Field id="nmat-custom" name="customName" label={t("Your own material")} maxLength={100} autoComplete="off" hint={t("For example a blend or a recycled grade.")} />
                </div>
                <div>
                  <SubmitButton>{t("Add material")}</SubmitButton>
                </div>
              </form>
            )}
          </>
        )}

        {/* ------------------------------------------------ 4 capacity */}
        {step === 4 && (
          <>
            <CapacityPlanner
              scope={organization.id}
              factoryId={id}
              isOwner={isOwner}
              processes={profile.processes.map((p) => ({ id: p.id, label: p.label, quantity: p.capacityQuantity, unit: p.capacityUnit, period: p.capacityPeriod }))}
              nextHref={`${here}?step=5`}
            />
            <details className="rounded-lg border bg-card px-4 py-3 text-sm sm:px-5">
              <summary className="cursor-pointer font-medium">{t("Advanced: I only know a factory-wide total")}</summary>
              <p className="mt-2 text-muted-foreground">
                {profile.factoryWide ? t("Currently declared: {capacity}.", { capacity: capacityText(profile.factoryWide, t) ?? "" }) : t("Not declared.")} {t("Use this only if you cannot split output by process. It is kept as you enter it and is not adjusted by utilisation.")}
              </p>
              {isOwner && (
                <form action={saveFactoryWideCapacity} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  {hidden}
                  <Field id="fw-q" name="capacityQuantity" label={t("Total capacity")} inputMode="decimal" defaultValue={profile.factoryWide?.capacityQuantity ?? ""} autoComplete="off" />
                  <Select id="fw-u" name="capacityUnit" label={t("Unit")} options={unitOptions} placeholder={t("Choose…")} defaultValue={profile.factoryWide?.capacityUnit} />
                  <Select id="fw-p" name="capacityPeriod" label={t("Per")} options={periodOptions} placeholder={t("Choose…")} defaultValue={profile.factoryWide?.capacityPeriod} />
                  <SubmitButton variant="outline">{t("Save")}</SubmitButton>
                </form>
              )}
            </details>
          </>
        )}

        {/* ------------------------------------------------ 5 review */}
        {step === 5 && (
          <>
            <dl className="divide-y rounded-lg border bg-card">
              {(
                [
                  [t("Products made here"), profile.products.length ? profile.products.map((p) => p.name).join(", ") : t("None yet"), 1],
                  [t("Processes"), profile.processes.length ? profile.processes.map((p) => t(p.label)).join(", ") : t("None yet"), 2],
                  [t("Machinery"), profile.machines.length ? t("{count} machines", { count: profile.machines.reduce((n, m) => n + m.quantity, 0) }) : t("None yet"), 2],
                  [t("Materials"), profile.materials.length ? profile.materials.map((m) => m.code ?? m.label).join(", ") : t("None yet"), 3],
                  [t("Reported capacity"), profile.processes.filter((p) => capacityText(p)).map((p) => `${t(p.label)}: ${capacityText(p, t)}`).join("; ") || t("Not given"), 4],
                ] as [string, string, number][]
              ).map(([k, v, s]) => (
                <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4 sm:px-5">
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words text-sm">{v}</dd>
                  <dd>
                    <Link href={`${here}?step=${s}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                      {t("Change")}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">{t("All of this was entered by you and has not been checked by us.")}</p>

            <section className="rounded-lg bg-mint p-6 sm:p-8" aria-labelledby="sugg-h">
              <p className="text-xs font-medium tracking-[0.14em] text-primary">{t("What your factory could also make")}</p>
              {found && !found.profileTooThin && found.adjacent.length > 0 ? (
                <>
                  <h2 id="sugg-h" className="mt-2 text-xl font-semibold tracking-tight">
                    {t("{count} products look like a fit", { count: found.adjacent.length })}
                  </h2>
                  <ul className="mt-3 grid gap-1 text-sm">
                    {found.adjacent.slice(0, 3).map((m) => (
                      <li key={m.entry.id}>
                        <span className="font-medium">{m.entry.name}</span> <span className="text-foreground/70">· {t(FIT_LABEL[m.level])}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <h2 id="sugg-h" className="mt-2 text-xl font-medium tracking-tight">
                  {t("Add at least one process to see suggestions")}
                </h2>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="outline" className="h-10 bg-card px-4">
                  <Link href="/opportunities">{t("Explore export potential")}</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-10 px-3">
                  <Link href={`/factories/${id}`}>{t("Open the full profile")}</Link>
                </Button>
              </div>
            </section>
          </>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        {step > 1 ? (
          <Button asChild variant="ghost" className="h-10 px-3">
            <Link href={`${here}?step=${step - 1}`}>{t("← Back")}</Link>
          </Button>
        ) : (
          <span />
        )}
        {step < 5 && (
          <Button asChild size="lg" className="h-10 px-5">
            <Link href={`${here}?step=${step + 1}`}>{step === 4 ? t("Review your profile") : t("Next: {step}", { step: STEPS[step].short })}</Link>
          </Button>
        )}
      </div>
    </>
  );
}

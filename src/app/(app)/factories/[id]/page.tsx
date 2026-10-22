import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton, Disclosure, Field, Flash, Select, SubmitButton } from "@/components/profile/form-bits";
import { requireOrganization } from "@/lib/organization";
import { getActiveFactory } from "@/lib/factories";
import { isUuid } from "@/lib/factory-validation";
import { capacityText, getFactoryProfile, getReferenceData, type MachineRow, type ProcessRow, type RefItem } from "@/lib/capabilities";
import { CAPACITY_PERIODS, CAPACITY_UNITS, RATING_UNITS } from "@/lib/capability-validation";
import { RATING_UNIT_LABELS } from "@/lib/opportunities/engine";
import {
  addMachine,
  addMaterial,
  addProcess,
  archiveMachine,
  removeMaterial,
  removeProcess,
  saveFactoryWideCapacity,
  updateMachine,
  updateProcess,
} from "@/lib/actions/capabilities";

export const metadata: Metadata = { title: "Factory profile · Export Enablement Platform" };
export const instant = false;

function CapacityFields({ id, p }: { id: string; p?: { capacityQuantity: number | null; capacityUnit: string | null; capacityPeriod: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field id={`${id}-q`} name="capacityQuantity" label="Capacity" inputMode="decimal" defaultValue={p?.capacityQuantity ?? ""} placeholder="e.g. 120" autoComplete="off" />
      <Select id={`${id}-u`} name="capacityUnit" label="Unit" options={CAPACITY_UNITS} placeholder="Choose…" defaultValue={p?.capacityUnit} />
      <Select id={`${id}-p`} name="capacityPeriod" label="Period" options={CAPACITY_PERIODS} placeholder="Choose…" defaultValue={p?.capacityPeriod} />
    </div>
  );
}

function MachineFields({ id, refs, m }: { id: string; refs: RefItem[]; m?: MachineRow }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field id={`${id}-name`} name="name" label="Machine name" defaultValue={m?.name} required maxLength={200} placeholder="e.g. Injection press 150T" autoComplete="off" />
        <Field id={`${id}-qty`} name="quantity" label="Quantity" inputMode="numeric" defaultValue={m?.quantity ?? 1} required autoComplete="off" />
      </div>
      <Select
        id={`${id}-proc`}
        name="process"
        label="Process it runs"
        options={refs.map((r) => ({ value: r.id, label: r.name }))}
        placeholder="Not specified"
        defaultValue={m?.processId}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field id={`${id}-rv`} name="ratingValue" label="Rating" inputMode="decimal" defaultValue={m?.ratingValue ?? ""} placeholder="e.g. 150" autoComplete="off" />
        <Select id={`${id}-ru`} name="ratingUnit" label="Rating unit" options={RATING_UNITS} placeholder="Choose when a rating is given" defaultValue={m?.ratingUnit} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${id}-make`} name="make" label="Make (optional)" defaultValue={m?.make ?? ""} maxLength={100} autoComplete="off" />
        <Field id={`${id}-model`} name="model" label="Model (optional)" defaultValue={m?.model ?? ""} maxLength={100} autoComplete="off" />
        <Field id={`${id}-year`} name="yearInstalled" label="Year installed (optional)" inputMode="numeric" defaultValue={m?.yearInstalled ?? ""} maxLength={4} autoComplete="off" />
      </div>
    </div>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? <CheckIcon className="size-4 text-primary" aria-hidden /> : <CircleDashedIcon className="size-4 text-muted-foreground" aria-hidden />}
      <span className={done ? "" : "text-muted-foreground"}>{children}</span>
      <span className="sr-only">{done ? "(done)" : "(not yet)"}</span>
    </li>
  );
}

function SectionCard({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function FactoryProfilePage({ params, searchParams }: PageProps<"/factories/[id]">) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const factory = await getActiveFactory(organization.id, id);
  if (!factory) notFound();
  const [profile, refs, sp] = await Promise.all([getFactoryProfile(organization.id, id), getReferenceData(), searchParams]);
  const isOwner = organization.role === "owner";
  const usedProcessIds = new Set(profile.processes.map((p) => p.processId));
  const usedMaterialIds = new Set(profile.materials.map((m) => m.materialId));
  const processOptions = refs.processes.filter((r) => !usedProcessIds.has(r.id)).map((r) => ({ value: r.id, label: r.name }));
  const materialOptions = refs.materials.filter((r) => !usedMaterialIds.has(r.id)).map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
  const hidden = <input type="hidden" name="factoryId" value={factory.id} />;
  const hasCapacity = !!profile.factoryWide || profile.processes.some((p) => p.capacityQuantity !== null);

  return (
    <>
      <PageHeader
        eyebrow="My Factory"
        title={factory.name}
        description={`${factory.addressLine1}${factory.addressLine2 ? `, ${factory.addressLine2}` : ""}, ${factory.city}, ${factory.state} ${factory.postalCode}, India`}
        action={
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Button asChild variant="outline">
                <Link href={`/factories/${factory.id}/edit`}>Edit details</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/opportunities">See export opportunities</Link>
            </Button>
          </div>
        }
      />
      <Flash params={sp} />

      <div className="mt-6 rounded-md border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">What the platform knows about this factory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The more you declare, the better your opportunity suggestions. Everything here is entered by you and is not checked by us.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <Check done={profile.processes.length > 0}>Manufacturing processes ({profile.processes.length})</Check>
          <Check done={hasCapacity}>Capacity declared</Check>
          <Check done={profile.machines.length > 0}>Machinery ({profile.machines.reduce((n, m) => n + m.quantity, 0)})</Check>
          <Check done={profile.materials.length > 0}>Materials ({profile.materials.length})</Check>
          <Check done={profile.products.length > 0}>Products made here ({profile.products.length})</Check>
        </ul>
      </div>

      {/* ---------------- processes and capacity ---------------- */}
      <SectionCard
        id="processes"
        title="Processes and capacity"
        description="What this factory can do, and how much. Capacity can be stated for one process or for the whole factory."
      >
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge kind="user" />
        </div>
        {profile.processes.length === 0 ? (
          <EmptyState title="No processes declared" description="Add the manufacturing processes this factory runs, such as injection moulding or extrusion." />
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {profile.processes.map((p: ProcessRow) => (
              <li key={p.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">
                      {p.label}
                      {p.custom && <span className="ml-2 text-xs font-normal text-muted-foreground">custom entry</span>}
                    </h3>
                    <p className="text-sm text-muted-foreground">{capacityText(p) ? `Capacity: ${capacityText(p)}` : "No capacity declared"}</p>
                  </div>
                  {isOwner && (
                    <ActionButton action={removeProcess} hidden={{ id: p.id, factoryId: factory.id }} label={`Remove ${p.label}`}>
                      Remove
                    </ActionButton>
                  )}
                </div>
                {isOwner && (
                  <Disclosure summary="Edit capacity" variant="link">
                    <form action={updateProcess} className="grid gap-4">
                      {hidden}
                      <input type="hidden" name="id" value={p.id} />
                      <CapacityFields id={`pc-${p.id}`} p={p} />
                      <div>
                        <SubmitButton>Save capacity</SubmitButton>
                      </div>
                    </form>
                  </Disclosure>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-md border bg-card px-4 py-3 sm:px-5">
          <h3 className="text-[15px] font-semibold">Factory-wide capacity</h3>
          <p className="text-sm text-muted-foreground">
            {profile.factoryWide ? `Declared: ${capacityText(profile.factoryWide)}` : "Not declared. Use this when you know the total output but not the split by process."}
          </p>
          {isOwner && (
            <Disclosure summary={profile.factoryWide ? "Change factory-wide capacity" : "Declare factory-wide capacity"} variant="link">
              <form action={saveFactoryWideCapacity} className="grid gap-4">
                {hidden}
                <CapacityFields id="fw" p={profile.factoryWide ?? undefined} />
                <div>
                  <SubmitButton>Save factory-wide capacity</SubmitButton>
                </div>
              </form>
            </Disclosure>
          )}
        </div>

        {isOwner && (
          <Disclosure summary="Add a process">
            <form action={addProcess} className="grid gap-4">
              {hidden}
              <div className="grid gap-4 sm:grid-cols-2">
                <Select id="np-process" name="process" label="Process" options={processOptions} placeholder="Choose from the list…" hint="Or leave this empty and name your own process." />
                <Field id="np-custom" name="customName" label="Custom process name" maxLength={100} autoComplete="off" hint="Only if it is not in the list." />
              </div>
              <CapacityFields id="np" />
              <p className="text-xs text-muted-foreground">Capacity is optional. If you give a number, choose its unit and period.</p>
              <div>
                <SubmitButton>Add process</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </SectionCard>

      {/* ---------------- machinery ---------------- */}
      <SectionCard id="machinery" title="Machinery" description="The machines behind those processes. Ratings help the platform judge what you could make.">
        <div className="mb-3">
          <StatusBadge kind="user" />
        </div>
        {profile.machines.length === 0 ? (
          <EmptyState title="No machinery declared" description="Add your presses, extruders and other key machines, with ratings if you know them." />
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {profile.machines.map((m) => (
              <li key={m.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-[15px] font-semibold">
                      {m.name} <span className="font-normal text-muted-foreground">× {m.quantity}</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {[
                        m.processName,
                        m.ratingValue !== null ? `${m.ratingValue} ${RATING_UNIT_LABELS[m.ratingUnit ?? ""] ?? m.ratingUnit}` : "no rating",
                        [m.make, m.model].filter(Boolean).join(" ") || null,
                        m.yearInstalled ? `installed ${m.yearInstalled}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {isOwner && (
                    <ActionButton action={archiveMachine} hidden={{ id: m.id, factoryId: factory.id }} label={`Remove ${m.name}`}>
                      Remove
                    </ActionButton>
                  )}
                </div>
                {isOwner && (
                  <Disclosure summary="Edit machine" variant="link">
                    <form action={updateMachine} className="grid gap-4">
                      {hidden}
                      <input type="hidden" name="id" value={m.id} />
                      <MachineFields id={`m-${m.id}`} refs={refs.processes} m={m} />
                      <div>
                        <SubmitButton>Save machine</SubmitButton>
                      </div>
                    </form>
                  </Disclosure>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <Disclosure summary="Add a machine">
            <form action={addMachine} className="grid gap-4">
              {hidden}
              <MachineFields id="nm" refs={refs.processes} />
              <div>
                <SubmitButton>Add machine</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </SectionCard>

      {/* ---------------- materials ---------------- */}
      <SectionCard id="materials" title="Materials" description="The polymers this factory can process. Add your own entry for anything not in the list.">
        <div className="mb-3">
          <StatusBadge kind="user" />
        </div>
        {profile.materials.length === 0 ? (
          <EmptyState title="No materials declared" description="Add the materials you can process, such as PP or HDPE." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.materials.map((m) => (
              <li key={m.id} className="flex items-center gap-1 rounded-md border bg-card py-1 pl-3 pr-1 text-sm">
                <span>{m.code ? `${m.code}` : m.label}</span>
                {m.custom && <span className="text-xs text-muted-foreground">(custom)</span>}
                {isOwner && (
                  <ActionButton action={removeMaterial} hidden={{ id: m.id, factoryId: factory.id }} label={`Remove ${m.label}`}>
                    ×
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <Disclosure summary="Add a material">
            <form action={addMaterial} className="grid gap-4">
              {hidden}
              <div className="grid gap-4 sm:grid-cols-2">
                <Select id="nmat-ref" name="material" label="Material" options={materialOptions} placeholder="Choose from the list…" hint="Or leave this empty and name your own material." />
                <Field id="nmat-custom" name="customName" label="Custom material" maxLength={100} autoComplete="off" hint="For example a blend or a recycled grade." />
              </div>
              <div>
                <SubmitButton>Add material</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </SectionCard>

      {/* ---------------- products ---------------- */}
      <SectionCard id="products" title="Products made here" description="The finished products this factory makes.">
        {profile.products.length === 0 ? (
          <EmptyState
            title="No products linked"
            description="Add a finished product and link it to this factory."
            action={
              isOwner && (
                <Button asChild>
                  <Link href={`/products/new?factory=${factory.id}`}>Add a product</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <ul className="divide-y rounded-md border bg-card">
              {profile.products.map((p) => (
                <li key={p.linkId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="break-words text-[15px] font-semibold">{p.name}</h3>
                    {p.category && <p className="text-sm text-muted-foreground">{p.category}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/products/${p.productId}`}>Open</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/opportunities/${p.productId}`}>Explore export potential</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {isOwner && (
              <p className="mt-3 text-sm">
                <Link href={`/products/new?factory=${factory.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  Add another product
                </Link>
              </p>
            )}
          </>
        )}
      </SectionCard>

      {!isOwner && <p className="mt-8 text-sm text-muted-foreground">Only company owners can change the manufacturing profile.</p>}
    </>
  );
}

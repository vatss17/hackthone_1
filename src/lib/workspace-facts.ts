import "server-only";
import { notFound } from "next/navigation";
import { listFactories } from "@/lib/factories";
import { loadEngineInput } from "@/lib/capabilities";
import { resolveSubject, type Subject } from "@/lib/subject";
import { discover, matchEntry } from "@/lib/opportunities/engine";
import { itemsFor, familyForEntry } from "@/lib/compliance/content";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import type { Inputs } from "@/lib/landed-cost/types";
import type { CatalogueEntry, MatchResult } from "@/lib/opportunities/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";

/**
 * Everything the server knows about one product and the company, in a form the browser-side
 * workspace can combine with what is saved locally. `ref` is a product id, a catalogue id, or
 * "standalone". An unknown ref is a 404, and a product id is only ever looked up inside the
 * signed-in user's own company.
 */
export async function loadWorkspaceFacts(
  org: { id: string; name: string; legalName: string | null },
  ref: string,
): Promise<{ facts: WorkspaceFacts; subject: Subject | null; defaults: Inputs; familyId: string | null; entry: CatalogueEntry | null; match: MatchResult | null }> {
  const standalone = ref === "standalone";
  const subject = standalone ? null : await resolveSubject(org.id, ref);
  if (!standalone && !subject) notFound();

  const [{ input, counts, factories }, listed] = await Promise.all([loadEngineInput(org.id), listFactories(org.id)]);
  const entry = subject?.entry ?? null;
  const match = entry ? matchEntry(entry, input) : null;
  const family = familyForEntry(entry?.id);
  const found = discover(input);

  const detail = subject?.detail ?? null;
  const linked = detail?.factories.map((f) => f.factoryId) ?? [];
  const home = listed.active.find((f) => linked.includes(f.id)) ?? listed.active[0];
  const address = home ? [home.addressLine1, home.addressLine2, `${home.city}, ${home.state} ${home.postalCode}`, "India"].filter(Boolean).join(", ") : null;

  const ids = (sections: Parameters<typeof itemsFor>[1][]) => (family ? sections.flatMap((s) => itemsFor(family, s).map((i) => i.id)) : []);
  const questions = {
    family: family?.id ?? null,
    all: ids(["indianExport", "uaeImport", "testing", "packaging", "hs", "cepa", "schemes"]),
    compliance: ids(["indianExport", "uaeImport", "packaging"]),
    testing: ids(["testing"]),
    hs: ids(["hs"]),
    cepa: ids(["cepa"]),
    schemes: ids(["schemes"]),
  };

  const facts: WorkspaceFacts = {
    ref: standalone ? "standalone" : ref,
    standalone,
    company: { name: org.name, legalName: org.legalName, address },
    product: subject
      ? {
          name: subject.name,
          own: subject.own,
          description: !!detail?.description,
          category: !!detail?.category,
          intendedUse: !!detail?.intendedUse,
          specCount: detail?.specs.length ?? 0,
          hsCode: detail?.hsCodeClaimed ?? null,
          unitWeightG: detail?.unitWeightG ?? null,
          unitsPerCarton: detail?.unitsPerCarton ?? null,
          cartonWeightKg: detail?.cartonGrossWeightKg ?? null,
          cartonDims: !!(detail?.cartonLengthMm && detail.cartonWidthMm && detail.cartonHeightMm),
          linkedFactories: detail?.factories.map((f) => f.name) ?? [],
          details: {
            description: detail?.description ?? null,
            category: detail?.category ?? null,
            intendedUse: detail?.intendedUse ?? null,
            specs: detail?.specs.map((s) => ({ name: s.name, value: s.value, unit: s.unit })) ?? [],
            materials: detail?.materials ?? [],
          },
        }
      : null,
    fit: { level: match?.level ?? null, score: match?.score ?? null, gaps: match?.gaps ?? [], missingProcesses: match?.missingProcesses ?? [] },
    profile: {
      processNames: input.processes.map((p) => p.label),
      materialNames: input.materials.map((m) => m.code ?? m.label),
      factories: factories.length,
      processes: counts.processes,
      machines: input.machines.length,
      ratedMachines: input.machines.filter((m) => m.ratingValue !== null).length,
      materials: counts.materials,
      capacity: input.factoryWideCapacity !== null || input.processes.some((p) => p.capacityText),
    },
    questions,
    opportunities: { count: found.adjacent.length, top: found.adjacent.slice(0, 3).map((m) => ({ id: m.entry.id, name: m.entry.name, score: m.score })) },
  };
  return { facts, subject, defaults: sampleInputs(subject ? { ...subject.facts, label: subject.name } : undefined), familyId: family?.id ?? null, entry, match };
}

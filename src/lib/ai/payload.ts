import type { Commercial } from "../explain/product.ts";
import type { EntryEvidence } from "../trade/evidence.ts";
import type { CatalogueEntry, MatchResult } from "../opportunities/types.ts";
import type { WorkspaceFacts } from "../workspace/types.ts";

/**
 * Exactly what is sent to the AI provider for an explanation, and nothing more. It describes the
 * product, the factory's capabilities, the rules-engine result, the trade snapshot and the user's own
 * commercial assumptions. It deliberately EXCLUDES the company name, addresses, tax or export codes,
 * buyer details and any identifier, so the provider receives capability facts, not identity.
 */
export function buildExplainPayload(args: {
  facts: WorkspaceFacts;
  entry: CatalogueEntry | null;
  match: MatchResult | null;
  commercial: Commercial | null;
  evidence: EntryEvidence;
}) {
  const { facts, entry, match, commercial } = args;
  const p = facts.product;
  const ev = args.evidence;
  return {
    product: p
      ? {
          name: p.name,
          ownedByManufacturer: p.own,
          category: p.details.category,
          intendedUse: p.details.intendedUse,
          description: p.details.description?.split("\n")[0].slice(0, 300) ?? null,
          materials: p.details.materials,
          specifications: p.details.specs.slice(0, 10),
        }
      : null,
    factory: {
      processes: facts.profile.processNames,
      materialsProcessed: facts.profile.materialNames,
      machineTypes: facts.profile.machines,
      machineTypesWithRatings: facts.profile.ratedMachines,
      capacityDeclared: facts.profile.capacity,
    },
    manufacturingFitByRules: match
      ? { level: match.level, capabilityScoreOutOf100: match.score, reasons: match.reasons, gaps: match.gaps, missingProcesses: match.missingProcesses }
      : null,
    catalogueNotes: entry
      ? { productType: entry.name, toolingUsuallyNeeded: entry.tooling, validationsUsuallyNeeded: entry.validations, customerIndustries: entry.industries.map((i) => i.name) }
      : null,
    uaeTradeEvidenceSnapshot: ev.hasData
      ? {
          note: "Reported values for broad HS headings. Not demand for this product.",
          headings: ev.headings.map((h) => ({
            hsHeading: h.heading,
            description: h.label,
            uaeReportedImportsAllCountries: h.latestUae ? { year: h.latestUae.year, valueUsd: Math.round(h.latestUae.valueUsd) } : null,
            indiaReportedExportsToUae: h.latestIndia ? { year: h.latestIndia.year, valueUsd: Math.round(h.latestIndia.valueUsd) } : null,
          })),
        }
      : null,
    commercialAssumptions: commercial
      ? { landedCostPerUnitAed: commercial.landedPerUnitAed, sellingPriceAed: commercial.sellingPriceAed, grossMarginPercent: commercial.grossMarginPct, targetMarginPercent: commercial.targetMarginPct, valuesAreSample: commercial.sample }
      : null,
    regulatoryStatus: "Not assessed. Nothing has been verified against official sources.",
  };
}

/**
 * Capability-to-Opportunity Intelligence: shared types.
 *
 * Everything the engine produces is INFERRED from the manufacturer's own profile plus a
 * hand-written catalogue. None of it is confirmed demand, confirmed feasibility, a legal
 * requirement or a market statistic. Each output field carries a provenance so the
 * interface can label it honestly.
 */

export type ProcessCode =
  | "injection_moulding"
  | "blow_moulding"
  | "extrusion"
  | "thermoforming"
  | "rotational_moulding"
  | "compression_moulding"
  | "additive_manufacturing"
  | "printing"
  | "finishing";

export type MaterialCode =
  | "PP"
  | "HDPE"
  | "LDPE"
  | "LLDPE"
  | "PET"
  | "PVC"
  | "PS"
  | "HIPS"
  | "ABS"
  | "PC"
  | "PA"
  | "PMMA"
  | "TPE"
  | "TPU";

/** Where a piece of information comes from. Mapped to the platform's status badges. */
export type Provenance = "user" | "inferred" | "illustrative" | "missing";

export type SizeClass = "small" | "medium" | "large";

/** How demanding qualification is expected to be. A rule of thumb, not a regulatory finding. */
export type QualificationEffort = "lighter" | "moderate" | "heavier";

export interface CatalogueEntry {
  id: string;
  name: string;
  /** Product family. Used to detect adjacency to what the manufacturer already makes. */
  group: string;
  summary: string;
  /** Lower-case words used to recognise this kind of product in a manufacturer's own product names. */
  keywords: string[];
  processes: {
    /** Every process listed here must be declared by the factory for a full match. */
    requiredAll: ProcessCode[];
    /** Processes that help but are not essential (for example injection moulding for pipe fittings). */
    helpful?: ProcessCode[];
  };
  materials: { preferred: MaterialCode[]; possible: MaterialCode[] };
  sizeClass: SizeClass;
  /** Tools, moulds, dies and equipment this product would typically need. */
  tooling: string[];
  /** Tests and validations a producer would typically need to plan for. */
  validations: string[];
  /** Hypotheses for why the UAE is worth investigating. Not data. */
  whyUae: string[];
  /** Illustrative placeholder, never a measurement. */
  demandSignal: "broad" | "moderate" | "niche";
  industries: { name: string; applications: string }[];
  /** Topics to check. Never a statement of what the law requires. */
  regulatoryFocus: string[];
  qualificationEffort: QualificationEffort;
}

/** What the engine knows about the manufacturer, built from real saved records. */
export interface FactoryInput {
  processes: { code: ProcessCode | null; label: string; capacityText: string | null }[];
  materials: { code: MaterialCode | null; label: string }[];
  machines: {
    processCode: ProcessCode | null;
    name: string;
    quantity: number;
    ratingValue: number | null;
    ratingUnit: string | null;
  }[];
  /** Factory-wide declared capacity, for example "300 tonnes per month", or null. */
  factoryWideCapacity: string | null;
  products: { id: string; name: string; category: string | null; description: string | null }[];
}

export interface FitPart {
  key: "processes" | "materials" | "machines" | "capacity" | "adjacency";
  label: string;
  points: number;
  max: number;
  detail: string;
}

export type FitLevel = "strong" | "good" | "possible" | "stretch";

export interface MatchResult {
  entry: CatalogueEntry;
  score: number;
  level: FitLevel;
  parts: FitPart[];
  /** Sentences tied to the manufacturer's own declared data. */
  reasons: string[];
  matchedProcesses: ProcessCode[];
  /** Declared processes this product needs that none of your current products uses today. */
  putsToWork: ProcessCode[];
  missingProcesses: ProcessCode[];
  matchedMaterials: MaterialCode[];
  /** Largest declared clamp force among relevant machines (tonnes), or null. */
  largestClampTonnes: number | null;
  /** What would have to be added or checked, derived from the gaps above plus the catalogue. */
  gaps: string[];
  /** Confidence in the capability fit only. Never "high": there is no market or regulatory evidence. */
  confidence: { level: "medium" | "low"; why: string };
}

export interface ProductOpportunity {
  product: FactoryInput["products"][number];
  /** The catalogue entry this product was recognised as, if any. */
  entry: CatalogueEntry | null;
  match: MatchResult | null;
}

import { CATALOGUE } from "./catalogue.ts";
import type {
  CatalogueEntry,
  FactoryInput,
  FitLevel,
  FitPart,
  MatchResult,
  MaterialCode,
  ProcessCode,
  ProductOpportunity,
} from "./types.ts";

/**
 * The matching engine. Small, transparent and rules-based on purpose.
 *
 * Input: the manufacturer's saved profile (processes, materials, machines, capacity, products).
 * Output: for each catalogue product, a capability-fit score with every point explained.
 *
 * What the score IS: how well the declared factory capabilities line up with what that kind of
 * product typically needs. What it is NOT: demand, price, feasibility, or compliance. Those need
 * verified trade data and expert review and are shown as "not yet verified" wherever they appear.
 *
 * Every weight is a constant below. Nothing is learned or hidden, and an AI layer can later add
 * suggestions or evidence without changing these rules.
 */
export const WEIGHTS = {
  processes: 45, // 40 for required processes + 5 when the helpful ones are there as well
  materials: 25,
  machines: 15,
  capacity: 5,
  adjacency: 10,
} as const;

/** A large product needs a large mould and press. Machine evidence is capped until confirmed. */
export const LARGE_PRODUCT_MACHINE_CAP = 8;

export const THRESHOLDS = { strong: 88, good: 65, possible: 45 } as const;

export const PROCESS_NAMES: Record<ProcessCode, string> = {
  injection_moulding: "Injection moulding",
  blow_moulding: "Blow moulding",
  extrusion: "Extrusion",
  thermoforming: "Thermoforming",
  rotational_moulding: "Rotational moulding",
  compression_moulding: "Compression moulding",
  additive_manufacturing: "Additive manufacturing",
  printing: "Printing",
  finishing: "Finishing",
};

export const MATERIAL_NAMES: Record<MaterialCode, string> = {
  PP: "Polypropylene (PP)",
  HDPE: "High-density polyethylene (HDPE)",
  LDPE: "Low-density polyethylene (LDPE)",
  LLDPE: "Linear low-density polyethylene (LLDPE)",
  PET: "Polyethylene terephthalate (PET)",
  PVC: "Polyvinyl chloride (PVC)",
  PS: "Polystyrene (PS)",
  HIPS: "High-impact polystyrene (HIPS)",
  ABS: "Acrylonitrile butadiene styrene (ABS)",
  PC: "Polycarbonate (PC)",
  PA: "Polyamide (nylon)",
  PMMA: "Poly(methyl methacrylate) (PMMA)",
  TPE: "Thermoplastic elastomer (TPE)",
  TPU: "Thermoplastic polyurethane (TPU)",
};

export const RATING_UNIT_LABELS: Record<string, string> = {
  tonnes_clamp_force: "tonnes clamp force",
  g_shot_weight: "g shot weight",
  kg_per_hour: "kg per hour",
  pieces_per_hour: "pieces per hour",
  mm_screw_diameter: "mm screw diameter",
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word (plural-tolerant) keyword test, so "cap" never matches "capacity". */
function hasKeyword(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}(s|es)?([^a-z0-9]|$)`).test(text);
}

/**
 * Recognises which catalogue product a manufacturer's own product most resembles, by keywords
 * in its name (weight 3), category (2) and description (1). Returns null when nothing matches.
 */
export function recognise(product: { name: string; category: string | null; description: string | null }): CatalogueEntry | null {
  const name = product.name.toLowerCase();
  const category = (product.category ?? "").toLowerCase();
  const description = (product.description ?? "").toLowerCase();
  let best: { entry: CatalogueEntry; hits: number } | null = null;
  for (const entry of CATALOGUE) {
    let hits = 0;
    for (const k of entry.keywords) {
      if (hasKeyword(name, k)) hits += 3;
      if (hasKeyword(category, k)) hits += 2;
      if (hasKeyword(description, k)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { entry, hits };
  }
  return best?.entry ?? null;
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Score one catalogue entry against the factory. Pure function: same input, same output. */
export function matchEntry(entry: CatalogueEntry, factory: FactoryInput): MatchResult {
  const declaredProcesses = new Set(factory.processes.map((p) => p.code).filter((c): c is ProcessCode => c !== null));
  const declaredMaterials = new Set(factory.materials.map((m) => m.code).filter((c): c is MaterialCode => c !== null));
  const customMaterials = factory.materials.filter((m) => m.code === null).map((m) => m.label);
  const reasons: string[] = [];
  const gaps: string[] = [];
  const optional: string[] = [];
  const parts: FitPart[] = [];

  // ---- processes
  const required = entry.processes.requiredAll;
  const helpful = entry.processes.helpful ?? [];
  const matchedProcesses = required.filter((p) => declaredProcesses.has(p));
  const missingProcesses = required.filter((p) => !declaredProcesses.has(p));
  const helpfulHave = helpful.filter((p) => declaredProcesses.has(p));
  const processPoints = Math.round(
    (40 * matchedProcesses.length) / required.length + (helpful.length === 0 ? 5 : (5 * helpfulHave.length) / helpful.length),
  );
  parts.push({
    key: "processes",
    label: "Manufacturing processes",
    points: processPoints,
    max: WEIGHTS.processes,
    detail:
      missingProcesses.length === 0
        ? `All required processes declared: ${list(required.map((p) => PROCESS_NAMES[p]))}.`
        : `Missing: ${list(missingProcesses.map((p) => PROCESS_NAMES[p]))}.`,
  });
  if (matchedProcesses.length > 0) {
    reasons.push(`You declared ${list(matchedProcesses.map((p) => PROCESS_NAMES[p].toLowerCase()))}, which this product needs.`);
  }
  if (helpfulHave.length > 0) {
    reasons.push(`You also declared ${list(helpfulHave.map((p) => PROCESS_NAMES[p].toLowerCase()))}, which helps for the connected parts of this product.`);
  }
  for (const p of missingProcesses) {
    gaps.push(`${PROCESS_NAMES[p]} is not in your declared processes. This would be a new capability, so treat it as a stretch.`);
  }
  for (const p of helpful.filter((x) => !declaredProcesses.has(x))) {
    optional.push(
      p === "extrusion" && entry.purchasedInputs?.length
        ? "Optional: extrusion, only if you want to make your own sheet. Sheet can be bought in, so it is not needed to start."
        : `Optional: ${PROCESS_NAMES[p].toLowerCase()} is not needed to make this product, but a fuller range may use it.`,
    );
  }

  // ---- materials
  const matchedPreferred = entry.materials.preferred.filter((m) => declaredMaterials.has(m));
  const matchedPossible = entry.materials.possible.filter((m) => declaredMaterials.has(m));
  let alternativeMaterials: MaterialCode[] = [];
  let materialPoints = 0;
  let materialDetail = "None of your declared materials is on this product's usual list.";
  if (matchedPreferred.length > 0) {
    materialPoints = Math.round(15 + (10 * matchedPreferred.length) / entry.materials.preferred.length);
    materialDetail = `Preferred material${matchedPreferred.length > 1 ? "s" : ""} declared: ${list(matchedPreferred)}.`;
    reasons.push(`You work with ${list(matchedPreferred)}, a usual material for this kind of product.`);
    const missingPreferred = entry.materials.preferred.filter((m) => !declaredMaterials.has(m));
    if (missingPreferred.length > 0 && matchedPreferred.length < entry.materials.preferred.length) {
      alternativeMaterials = missingPreferred;
      optional.push(`Alternative grades also used for this product, not required: ${list(missingPreferred)}. Confirm which grade suits the application.`);
    }
  } else if (matchedPossible.length > 0) {
    materialPoints = 10;
    materialDetail = `Possible but not the usual material: ${list(matchedPossible)}.`;
    reasons.push(`You work with ${list(matchedPossible)}, which can be used but is not the usual choice here.`);
    gaps.push(`The usual material for this product is ${list(entry.materials.preferred)}. A supplier and trial would be needed.`);
  } else {
    gaps.push(`The usual material for this product (${list(entry.materials.preferred)}) is not among your declared materials.`);
    if (customMaterials.length > 0) {
      materialDetail = `Your custom materials (${list(customMaterials)}) cannot be matched automatically.`;
    }
  }
  parts.push({ key: "materials", label: "Materials", points: materialPoints, max: WEIGHTS.materials, detail: materialDetail });

  // ---- machines
  const relevantCodes = new Set<ProcessCode>([...required, ...helpful]);
  const relevantMachines = factory.machines.filter((m) => m.processCode !== null && relevantCodes.has(m.processCode) && declaredProcesses.has(m.processCode));
  const requiredMachines = factory.machines.filter((m) => m.processCode !== null && required.includes(m.processCode));
  const rated = requiredMachines.filter((m) => m.ratingValue !== null);
  const clamps = relevantMachines
    .filter((m) => m.processCode === "injection_moulding" && m.ratingUnit === "tonnes_clamp_force" && m.ratingValue !== null)
    .map((m) => m.ratingValue as number);
  const largestClampTonnes = clamps.length > 0 ? Math.max(...clamps) : null;
  let machinePoints = 0;
  let machineDetail = "No machine is declared for the required processes.";
  if (rated.length > 0) {
    machinePoints = WEIGHTS.machines;
    machineDetail = `${requiredMachines.reduce((n, m) => n + m.quantity, 0)} machine(s) declared for this process, with ratings.`;
    const first = rated.reduce((a, b) => ((b.ratingValue ?? 0) > (a.ratingValue ?? 0) ? b : a));
    reasons.push(
      `Your ${first.name}${first.quantity > 1 ? ` (×${first.quantity})` : ""} is rated ${first.ratingValue} ${RATING_UNIT_LABELS[first.ratingUnit ?? ""] ?? first.ratingUnit}, which is evidence you can run this process.`,
    );
  } else if (requiredMachines.length > 0) {
    machinePoints = 10;
    machineDetail = "Machines are declared but none has a rating.";
    gaps.push("Add ratings (for example clamp force or screw diameter) to your machines to firm up this match.");
  } else if (required.every((p) => declaredProcesses.has(p))) {
    gaps.push(`You declared ${list(required.map((p) => PROCESS_NAMES[p].toLowerCase()))} but list no machine for ${required.length > 1 ? "them" : "it"}. Add the machinery to firm up this match.`);
  }
  if (entry.sizeClass === "large") {
    machinePoints = Math.min(machinePoints, LARGE_PRODUCT_MACHINE_CAP);
    machineDetail += " Capped because large products need a press and mould sized to the product.";
    gaps.push(
      largestClampTonnes !== null
        ? `Your largest declared press is ${largestClampTonnes} tonnes. A large product needs a press sized to its mould: confirm with a toolmaker before committing.`
        : "No press size is declared. A large product needs a press sized to its mould: confirm with a toolmaker.",
    );
  } else if (entry.sizeClass === "medium" && largestClampTonnes !== null && matchedProcesses.includes("injection_moulding")) {
    optional.push(`When you scope the tooling, check mould size against your largest declared press (${largestClampTonnes} tonnes).`);
  }
  parts.push({ key: "machines", label: "Machinery evidence", points: machinePoints, max: WEIGHTS.machines, detail: machineDetail });

  // ---- capacity
  const processWithCapacity = factory.processes.find((p) => p.code !== null && matchedProcesses.includes(p.code) && p.capacityText);
  const capacityPoints = processWithCapacity || factory.factoryWideCapacity ? WEIGHTS.capacity : 0;
  parts.push({
    key: "capacity",
    label: "Declared capacity",
    points: capacityPoints,
    max: WEIGHTS.capacity,
    detail: processWithCapacity
      ? `Capacity declared for ${processWithCapacity.label.toLowerCase()}: ${processWithCapacity.capacityText}.`
      : factory.factoryWideCapacity
        ? `Factory-wide capacity declared: ${factory.factoryWideCapacity}.`
        : "No capacity declared yet.",
  });
  if (processWithCapacity) reasons.push(`You declared ${processWithCapacity.capacityText} of ${processWithCapacity.label.toLowerCase()} capacity.`);
  else if (factory.factoryWideCapacity) reasons.push(`You declared ${factory.factoryWideCapacity} of factory-wide capacity.`);
  else gaps.push("Declare your capacity so volumes can be compared with what a buyer might need.");

  // ---- adjacency to what is already made
  const sibling = factory.products
    .map((p) => ({ product: p, entry: recognise(p) }))
    .find((x) => x.entry && x.entry.id !== entry.id && x.entry.group === entry.group);
  const adjacencyPoints = sibling ? WEIGHTS.adjacency : 0;
  parts.push({
    key: "adjacency",
    label: "Close to what you already make",
    points: adjacencyPoints,
    max: WEIGHTS.adjacency,
    detail: sibling ? `Same product family as your ${sibling.product.name}.` : "Not in the same product family as your current products.",
  });
  if (sibling) reasons.push(`It sits in the same product family as your ${sibling.product.name}, so customers and know-how may carry over.`);

  const score = parts.reduce((n, p) => n + p.points, 0);
  const level: FitLevel =
    missingProcesses.length > 0 ? "stretch" : score >= THRESHOLDS.strong ? "strong" : score >= THRESHOLDS.good ? "good" : "possible";

  const confidence: MatchResult["confidence"] =
    missingProcesses.length === 0 && materialPoints >= 15 && machinePoints >= 8
      ? { level: "medium", why: "Your processes, materials and machinery all line up. Demand, cost and compliance are still unverified, so confidence cannot be higher." }
      : { level: "low", why: "Some of the capability evidence is missing or only partly matches, and demand, cost and compliance are unverified." };

  const machineListed = (code: ProcessCode) => factory.machines.some((m) => m.processCode === code);
  const guidance: MatchResult["guidance"] = {
    requiredProcesses: required.map((code) => ({ code, declared: declaredProcesses.has(code), machineListed: machineListed(code) })),
    optionalProcesses: helpful.map((code) => ({ code, declared: declaredProcesses.has(code) })),
    purchasedInputs: entry.purchasedInputs ?? [],
    missingMachinery: required.filter((c) => declaredProcesses.has(c) && !machineListed(c)),
    alternativeMaterials,
  };
  return { entry, score, level, parts, reasons, matchedProcesses, putsToWork: [], missingProcesses, matchedMaterials: matchedPreferred.concat(matchedPossible), largestClampTonnes, gaps, optional, guidance, confidence };
}

const EFFORT_RANK = { lighter: 0, moderate: 1, heavier: 2 } as const;

export interface Discovery {
  /** The manufacturer's own products, each with the catalogue product it resembles (if any). */
  yourProducts: ProductOpportunity[];
  /** Adjacent products the declared capabilities support. Excludes what is already made. */
  adjacent: MatchResult[];
  /** Products that would need a process the factory has not declared. */
  stretch: MatchResult[];
  /** Declared processes that none of the manufacturer's recognised products uses today. */
  underusedProcesses: ProcessCode[];
  /** True when the factory profile has too little data to suggest anything. */
  profileTooThin: boolean;
}

export function discover(factory: FactoryInput): Discovery {
  const yourProducts: ProductOpportunity[] = factory.products.map((product) => {
    const entry = recognise(product);
    return { product, entry, match: entry ? matchEntry(entry, factory) : null };
  });
  const alreadyMade = new Set(yourProducts.map((p) => p.entry?.id).filter((id): id is string => !!id));

  const profileTooThin = factory.processes.filter((p) => p.code !== null).length === 0;
  // A declared process is "under-used" when products are recognised but none of them needs it.
  const usedByProducts = new Set(yourProducts.flatMap((p) => p.entry?.processes.requiredAll ?? []));
  const underusedProcesses =
    usedByProducts.size === 0
      ? []
      : factory.processes.map((p) => p.code).filter((c): c is ProcessCode => c !== null && !usedByProducts.has(c));
  const all = profileTooThin ? [] : CATALOGUE.filter((e) => !alreadyMade.has(e.id)).map((e) => matchEntry(e, factory));
  for (const m of all) m.putsToWork = m.matchedProcesses.filter((p) => underusedProcesses.includes(p));
  const order = (a: MatchResult, b: MatchResult) =>
    b.score - a.score || EFFORT_RANK[a.entry.qualificationEffort] - EFFORT_RANK[b.entry.qualificationEffort] || a.entry.name.localeCompare(b.entry.name);

  return {
    yourProducts,
    adjacent: all.filter((m) => m.level !== "stretch" && m.score >= THRESHOLDS.possible).sort(order),
    stretch: all.filter((m) => m.level === "stretch").sort(order),
    underusedProcesses,
    profileTooThin,
  };
}

export const FIT_LABEL: Record<FitLevel, string> = {
  strong: "Strong capability fit",
  good: "Good capability fit",
  possible: "Possible fit",
  stretch: "Stretch: needs a new process",
};

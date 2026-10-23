import type { FactoryInput, MaterialCode, ProcessCode } from "../opportunities/types.ts";
import { MATERIAL_NAMES, PROCESS_NAMES } from "../opportunities/engine.ts";

/** What the first-time factory questions offer. Plain-English text sits beside the engine's own codes. */
export const START_PROCESSES: { code: ProcessCode; plain: string }[] = [
  { code: "injection_moulding", plain: "Melted plastic is pushed into a metal mould to make shaped items such as crates, buckets and caps." },
  { code: "extrusion", plain: "Melted plastic is pushed through a die to make a continuous shape such as pipe, sheet or profile." },
  { code: "blow_moulding", plain: "Air blows a hot plastic tube against a mould to make hollow items such as bottles and drums." },
  { code: "thermoforming", plain: "A heated plastic sheet is pulled over a mould to make trays, cups and lids." },
];

export const START_MATERIALS: { code: MaterialCode; plain: string }[] = [
  { code: "PP", plain: "Light and tough. Common in storage boxes and food containers." },
  { code: "HDPE", plain: "Stiff and chemical-resistant. Common in pipes, drums and buckets." },
  { code: "LDPE", plain: "Soft and flexible. Common in films, bags and squeeze bottles." },
  { code: "PET", plain: "Clear and strong. Common in bottles and trays." },
];

export const processName = (c: ProcessCode) => PROCESS_NAMES[c];
export const materialName = (c: MaterialCode) => MATERIAL_NAMES[c];

export type StartMachine = { processCode: ProcessCode; size: string };

/** Turns "150 tonnes" into the units the database stores. Anything it cannot read is kept out of the rating and left for the person to add. */
export function parseRating(text: string): { value: number; unit: "tonnes_clamp_force" | "kg_per_hour" } | null {
  // "ટન" (Gujarati) and "टन" (Hindi) both mean tonnes.
  const m = text.replace(/ટન|टन/g, " tonnes").match(/(\d+(?:\.\d+)?)\s*(tonnes?|t|kg\s*\/?\s*h(?:our)?)\b/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!(value > 0)) return null;
  return /^kg/i.test(m[2]) ? { value, unit: "kg_per_hour" } : { value, unit: "tonnes_clamp_force" };
}

/** The same input shape the saved-record engine uses, built from answers that are not saved yet. */
export function factoryInputFromAnswers(a: { processes: ProcessCode[]; materials: MaterialCode[]; machines: StartMachine[]; products: string[] }): FactoryInput {
  return {
    processes: a.processes.map((code) => ({ code, label: PROCESS_NAMES[code], capacityText: null })),
    materials: a.materials.map((code) => ({ code, label: MATERIAL_NAMES[code] })),
    machines: a.machines.map((m) => {
      const r = parseRating(m.size);
      return { processCode: m.processCode, name: `${PROCESS_NAMES[m.processCode]} machine`, quantity: 1, ratingValue: r?.value ?? null, ratingUnit: r?.unit ?? null };
    }),
    factoryWideCapacity: null,
    products: a.products.map((name, i) => ({ id: `answer-${i}`, name, category: null, description: null })),
  };
}

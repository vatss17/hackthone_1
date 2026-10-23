import { sampleCalc, SAMPLE_ASSUMPTIONS } from "./calc.ts";
import { OPPORTUNITIES } from "./data.ts";

/**
 * SIMULATED "AI" for the wireframes. No model is called anywhere: these are fixed,
 * deterministic rules that stand in for what an AI step would return, so reviewers can
 * judge the experience. Every result is shown as a suggestion the person must confirm.
 */

export type Confidence = "High" | "Medium" | "Low";

export type HsSuggestion = { code: string; label: string; why: string; confidence: Confidence };

const RULES: { re: RegExp; list: HsSuggestion[] }[] = [
  {
    re: /pipe|conduit|tube|hose/i,
    list: [{ code: "3917", label: "Tubes, pipes and hoses of plastics", why: "The description mentions a pipe or tube.", confidence: "High" }],
  },
  {
    re: /bottle|drum|jar|container|lid|cap|closure/i,
    list: [
      { code: "3923", label: "Containers and closures of plastics", why: "It is described as a container, bottle, drum or lid.", confidence: "High" },
      { code: "3924", label: "Household articles of plastics", why: "Possible if it is mainly for the home.", confidence: "Low" },
    ],
  },
  {
    re: /crate|box|basket|bucket|mug|hanger|storage|tub|bin/i,
    list: [
      { code: "3924", label: "Household articles of plastics", why: "Storage and household items usually sit here.", confidence: "Medium" },
      { code: "3923", label: "Containers and closures of plastics", why: "Possible if sold mainly for transporting goods.", confidence: "Medium" },
      { code: "3926", label: "Other articles of plastics", why: "A general fallback when nothing else fits.", confidence: "Low" },
    ],
  },
];

export const PHOTO_TEXT = "plastic storage crate";

export function suggestHs(text: string): HsSuggestion[] {
  const t = text.trim();
  if (t.length < 3) return [];
  const hit = RULES.find((r) => r.re.test(t));
  return hit?.list ?? [{ code: "3926", label: "Other articles of plastics", why: "We could not tell what it is from the words given.", confidence: "Low" }];
}

export type MachineField = { label: string; value: string; status: "Read from the nameplate" | "Our guess, please check" | "Could not read" };

/** Same fictional answer for any photo: the wireframe shows the review step, not recognition quality. */
export function recogniseMachine(): { title: string; type: string; fields: MachineField[] } {
  return {
    title: "Injection moulding machine",
    type: "injection",
    fields: [
      { label: "Machine type", value: "Injection moulding", status: "Our guess, please check" },
      { label: "Clamp force", value: "150 tonnes", status: "Read from the nameplate" },
      { label: "Screw diameter", value: "40 mm", status: "Our guess, please check" },
      { label: "Make and model", value: "", status: "Could not read" },
      { label: "Year", value: "", status: "Could not read" },
    ],
  };
}

export type AiLine = { label: string; aed: number; how: string; confidence: Confidence };
export type AiEstimate = {
  ok: boolean;
  problem?: string;
  hs: string;
  steps: string[];
  lines: AiLine[];
  /** Price at which the landed cost leaves a 20% margin: derived, not a market price. */
  priceFor20: number;
};

export const AI_STEPS = [
  "Reading your product and your quoted price",
  "Choosing the likely customs heading",
  "Estimating sea freight for one 40 ft container",
  "Adding insurance",
  "Working out import duty",
  "Adding port clearance",
  "Adding it all up per unit",
];

const HOW: Record<string, [string, Confidence]> = {
  "Product at factory gate": ["Your quoted price converted to AED at a sample rate.", "High"],
  "Sea freight share": ["Container freight shared across the units that fit. Replace with a real quote.", "Low"],
  "Insurance (sample rate)": ["A small percentage of the goods value.", "Medium"],
  "Import duty (sample rate)": ["A sample rate for the likely heading. Must be verified before you rely on it.", "Low"],
  "Port clearance share": ["A typical fixed clearance charge shared across the units.", "Medium"],
};

export function aiLandedEstimate(price: number, oppId: string): AiEstimate {
  const opp = OPPORTUNITIES.find((o) => o.id === oppId) ?? OPPORTUNITIES[0];
  const r = sampleCalc({ price, freight: opp.defaultCalc.freight, reference: opp.defaultCalc.reference });
  const hs = opp.hsCandidates[0].code;
  if (!r.ok) return { ok: false, problem: r.problem, hs, steps: AI_STEPS, lines: [], priceFor20: 0 };
  const lines = r.parts.map((p) => ({ label: p.label, aed: p.aed, how: HOW[p.label][0], confidence: HOW[p.label][1] }));
  return { ok: true, hs, steps: AI_STEPS, lines, priceFor20: Math.round((r.landedAed / 0.8) * 100) / 100 };
}

/** Landed cost with the person's own overrides applied; an override always wins over the AI's number. */
export function totalWithOverrides(lines: AiLine[], overrides: Record<string, number>) {
  const sum = lines.reduce((t, l) => t + (Number.isFinite(overrides[l.label]) ? overrides[l.label] : l.aed), 0);
  return Math.round(sum * 100) / 100;
}

export const UNITS_PER_CONTAINER = SAMPLE_ASSUMPTIONS.unitsPerContainer;

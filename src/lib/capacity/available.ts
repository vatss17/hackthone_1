/**
 * Available manufacturing capacity, worked out from what the manufacturer reports.
 *
 *   available process capacity = reported process capacity x (1 - utilisation)
 *
 * Rules this module keeps, on purpose:
 *   - Nothing is invented. No cycle times, throughput or machine data are assumed. Capacity, unit, period and
 *     utilisation all come from the manufacturer. Shifts and hours are context only and are NOT used in the sum.
 *   - Units and periods are never converted (that would need working-day assumptions). Two figures are only
 *     compared or combined when their unit AND period are identical.
 *   - Sequential stages of one production line are NEVER summed. A line makes only as much as its slowest stage,
 *     so a factory-wide figure is derived only when the manufacturer says how the processes relate:
 *       "sequential": one line, so the governing bottleneck (smallest available figure) limits the whole line;
 *       "parallel": separate lines, so figures with identical unit and period are added;
 *       "unknown": nothing is derived. Process-level estimates are shown and the manufacturer is asked.
 *   - Every number carries its provenance: reported by the manufacturer, calculated estimate, or not available.
 */

export interface ProcessCapacityInput {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  period: string | null;
  /** 0 to 100, as reported by the manufacturer. Null when not given. */
  utilisationPct: number | null;
}

export type Layout = "sequential" | "parallel" | "unknown";

export type Provenance = "reported" | "calculated" | "unavailable";

export interface ProcessEstimate {
  id: string;
  label: string;
  reported: { quantity: number; unit: string; period: string } | null;
  utilisationPct: number | null;
  available: { quantity: number; unit: string; period: string } | null;
  provenance: Provenance;
  /** Why there is no estimate, in words for the interface. Empty when there is one. */
  missing: string;
}

export interface FactoryEstimate {
  /** Null when it cannot be derived safely. */
  value: { quantity: number; unit: string; period: string } | null;
  provenance: Provenance;
  basis: "bottleneck" | "sum_of_parallel_lines" | "none";
  /** The process that limits a sequential line, when known. */
  governing: { id: string; label: string } | null;
  /** What the manufacturer needs to confirm or provide, in words. */
  ask: string;
}

export const isValidUtilisation = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;

const round = (n: number) => Math.round(n * 100) / 100;

export function estimateProcess(p: ProcessCapacityInput): ProcessEstimate {
  const base = { id: p.id, label: p.label, utilisationPct: p.utilisationPct, available: null, provenance: "unavailable" as Provenance };
  if (p.quantity === null || !(p.quantity > 0) || !p.unit || !p.period) return { ...base, reported: null, missing: "No capacity has been reported for this process." };
  const reported = { quantity: p.quantity, unit: p.unit, period: p.period };
  if (p.utilisationPct === null) return { ...base, reported, missing: "Current utilisation has not been provided, so available capacity cannot be estimated." };
  if (!isValidUtilisation(p.utilisationPct)) return { ...base, reported, missing: "Utilisation must be between 0 and 100 per cent." };
  return { ...base, reported, available: { quantity: round(p.quantity * (1 - p.utilisationPct / 100)), unit: p.unit, period: p.period }, provenance: "calculated", missing: "" };
}

const sameBasis = (a: { unit: string; period: string }, b: { unit: string; period: string }) => a.unit === b.unit && a.period === b.period;

/**
 * A factory-wide figure, only when it can be derived safely. `governingId` is the process the manufacturer confirmed
 * as the bottleneck of a sequential line; without it the smallest comparable figure is proposed, never silently used.
 */
export function estimateFactory(estimates: ProcessEstimate[], layout: Layout, governingId: string | null = null): FactoryEstimate {
  const withFigure = estimates.filter((e) => e.available !== null);
  const none = (ask: string): FactoryEstimate => ({ value: null, provenance: "unavailable", basis: "none", governing: null, ask });
  if (withFigure.length === 0) return none("Provide capacity and utilisation for at least one process to see an estimate.");
  if (layout === "unknown") return none("Tell us how your processes relate (one line in sequence, or separate lines) before a factory-wide figure is shown. Process-level estimates are shown above.");

  const first = withFigure[0].available!;
  const comparable = withFigure.every((e) => sameBasis(e.available!, first));
  if (!comparable) return none("Your processes use different units or periods, so they cannot be compared or combined without assumptions. Confirm which process governs your output.");

  if (layout === "parallel") {
    const total = round(withFigure.reduce((n, e) => n + e.available!.quantity, 0));
    return { value: { quantity: total, unit: first.unit, period: first.period }, provenance: "calculated", basis: "sum_of_parallel_lines", governing: null, ask: "Adds figures only because you said these are separate lines. Check that no two share the same capacity." };
  }

  // sequential: the slowest stage governs
  const smallest = withFigure.reduce((m, e) => (e.available!.quantity < m.available!.quantity ? e : m));
  const confirmed = governingId ? withFigure.find((e) => e.id === governingId) : undefined;
  if (!confirmed) {
    return { value: null, provenance: "unavailable", basis: "none", governing: { id: smallest.id, label: smallest.label }, ask: `In a line of sequential stages the slowest stage limits output. ${smallest.label} has the smallest available figure. Confirm it is your bottleneck, or choose another.` };
  }
  return { value: { quantity: confirmed.available!.quantity, unit: first.unit, period: first.period }, provenance: "calculated", basis: "bottleneck", governing: { id: confirmed.id, label: confirmed.label }, ask: confirmed.id === smallest.id ? "" : `${smallest.label} has a smaller figure than the stage you chose. Check which stage really limits output.` };
}

/** Plain-language provenance label. */
export const PROVENANCE_LABEL: Record<Provenance, string> = { reported: "Reported by you", calculated: "Calculated estimate", unavailable: "Not available" };

type Translate = (source: string, vars?: Record<string, string | number>) => string;

/** Units and periods as people read them. Codes such as kg and tonnes stay as they are; `t` turns the rest into the reader's language. */
const PERIOD_WORDS: Record<string, string> = { day: "per day", month: "per month", year: "per year" };

/** "63 tonnes per month". With `t`, the unit word and the period are translated; the number and the codes are not. */
export const formatQuantity = (q: { quantity: number; unit: string; period: string }, t?: Translate) => {
  const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(q.quantity);
  if (!t) return `${num} ${q.unit} per ${q.period}`;
  const unit = q.unit === "pieces" ? t("pieces") : q.unit === "metres" ? t("metres") : q.unit;
  return `${num} ${unit} ${PERIOD_WORDS[q.period] ? t(PERIOD_WORDS[q.period]) : `per ${q.period}`}`;
};

/**
 * Translates the sentences above for display. Fixed ones are looked up as they are; the two that name a process are matched and
 * translated with the name filled in, so the process name (the manufacturer's own words) is never altered.
 */
export function translateEstimateMessage(message: string, t: Translate): string {
  const a = message.match(/^In a line of sequential stages the slowest stage limits output\. (.+) has the smallest available figure\. Confirm it is your bottleneck, or choose another\.$/);
  if (a) return t("In a line of sequential stages the slowest stage limits output. {label} has the smallest available figure. Confirm it is your bottleneck, or choose another.", { label: a[1] });
  const b = message.match(/^(.+) has a smaller figure than the stage you chose\. Check which stage really limits output\.$/);
  if (b) return t("{label} has a smaller figure than the stage you chose. Check which stage really limits output.", { label: b[1] });
  return t(message);
}

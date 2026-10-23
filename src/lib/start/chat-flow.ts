import type { MaterialCode, ProcessCode } from "../opportunities/types.ts";
import type { MaterialCodeV, ProcessCodeV, VoiceRow } from "../ai-input/voice.ts";
import { localExtractFactory } from "../ai-input/local-extract.ts";
import { interpolate, type Vars } from "../i18n/translate.ts";
import type { StartMachine } from "./capability.ts";
import { readProduct, type ReadRow } from "./read-product.ts";

/**
 * The pure logic behind the "set up by chatting" option. The chat asks one question at a time, reads the answer (with the
 * server AI if the person agreed, else by plain word matching) and ADDS what it found to the same answers the forms keep.
 * Nothing here saves anything, and nothing here removes or overwrites what the person already chose.
 *
 * Sentences are English templates with {placeholders}; the screen translates them when it draws them (see CHAT_TEMPLATES).
 */

export type Path = "factory" | "product";
export type Say = {
  t: (source: string, vars?: Vars) => string;
  process: (code: ProcessCode) => string;
  material: (code: MaterialCode) => string;
};

// ---- the question scripts --------------------------------------------------------------------------------------------------

export type Chip = {
  /** English text shown (and translated) on the chip, or a polymer code that is shown as is. */
  label: string;
  /** What is read when the chip is used. Always English or a code, so the reader does not depend on the interface language. */
  value: string;
  /** send: used at once. toggle: ticked, then sent with the Send button. skip: moves on without reading anything. */
  kind: "send" | "toggle" | "skip";
  /** Polymer codes are never translated. */
  plain?: boolean;
};

export type Question = { id: QuestionId; text: string; placeholder: string; chips: Chip[] };
export type QuestionId = "make" | "materials" | "machines" | "products" | "name" | "details" | "follow_both" | "follow_material" | "follow_use";

export const SKIP_CHIP: Chip = { label: "Skip this question", value: "", kind: "skip" };
const UNSURE_CHIP: Chip = { label: "I'm not sure", value: "", kind: "skip" };
const POLYMERS = ["PP", "HDPE", "LDPE", "PET", "PVC", "ABS"] as const;

export const QUESTIONS: Record<QuestionId, Question> = {
  make: {
    id: "make",
    text: "What does your factory make, and how?",
    placeholder: "e.g. We make crates and buckets by injection moulding",
    chips: [
      { label: "Crates and buckets by injection moulding", value: "We make crates and buckets by injection moulding", kind: "send" },
      { label: "Bottles by blow moulding", value: "We make bottles by blow moulding", kind: "send" },
      { label: "Pipes by extrusion", value: "We make pipes by extrusion", kind: "send" },
      { label: "Trays and cups by thermoforming", value: "We make trays and cups by thermoforming", kind: "send" },
    ],
  },
  materials: {
    id: "materials",
    text: "Which plastics do you work with?",
    placeholder: "e.g. PP and HDPE",
    chips: [...POLYMERS.map((p): Chip => ({ label: p, value: p, kind: "toggle", plain: true })), UNSURE_CHIP],
  },
  machines: {
    id: "machines",
    text: "How many machines do you have of each kind, and how big?",
    placeholder: "e.g. 3 injection moulding machines, 150 tonnes",
    chips: [UNSURE_CHIP],
  },
  products: {
    id: "products",
    text: "What do you make today?",
    placeholder: "e.g. storage crates, buckets",
    chips: [SKIP_CHIP],
  },
  name: {
    id: "name",
    text: "What is the product called?",
    placeholder: "e.g. Stackable storage crate 40 L",
    chips: [],
  },
  details: {
    id: "details",
    text: "Tell me about it: what it is made of, what it is used for, how much it weighs and how big it is.",
    placeholder: "e.g. PP crate, 1.9 kg, 600 x 400 x 250 mm, for household storage",
    chips: [SKIP_CHIP],
  },
  follow_both: {
    id: "follow_both",
    text: "One more thing: which material is it made of, and what is it used for?",
    placeholder: "e.g. HDPE, used for storing goods",
    chips: [...(["PP", "HDPE", "LDPE", "PET"] as const).map((p): Chip => ({ label: p, value: p, kind: "send", plain: true })), SKIP_CHIP],
  },
  follow_material: {
    id: "follow_material",
    text: "One more thing: which material is it made of?",
    placeholder: "e.g. HDPE",
    chips: [...(["PP", "HDPE", "LDPE", "PET"] as const).map((p): Chip => ({ label: p, value: p, kind: "send", plain: true })), SKIP_CHIP],
  },
  follow_use: {
    id: "follow_use",
    text: "One more thing: what is it used for?",
    placeholder: "e.g. storing goods",
    chips: [SKIP_CHIP],
  },
};

export const FACTORY_SCRIPT: QuestionId[] = ["make", "materials", "machines", "products"];

/** The first question the chat asks for a path, given what is already filled in (a product name that is there is not asked again). */
export const firstQuestion = (path: Path, product?: ProductAnswers): QuestionId => (path === "factory" ? "make" : product && product.name.trim().length >= 2 ? "details" : "name");

/** The question after `id`, or null when it is time to show the summary. */
export function nextQuestion(path: Path, id: QuestionId, product?: ProductAnswers): QuestionId | null {
  if (path === "factory") {
    const i = FACTORY_SCRIPT.indexOf(id);
    return i >= 0 && i < FACTORY_SCRIPT.length - 1 ? FACTORY_SCRIPT[i + 1] : null;
  }
  if (id === "name") return "details";
  if (id === "details" && product) {
    const f = productFollowUp(product);
    return f ? (`follow_${f}` as QuestionId) : null;
  }
  return null;
}

/** "Question 2 of 4": the position and the total for the progress line (the product follow-up counts as the last question). */
export function progress(path: Path, id: QuestionId): { n: number; total: number } {
  if (path === "factory") return { n: FACTORY_SCRIPT.indexOf(id) + 1, total: FACTORY_SCRIPT.length };
  return { n: id === "name" ? 1 : id === "details" ? 2 : 3, total: 3 };
}

// ---- the person's answers (the same shapes the forms keep) -------------------------------------------------------------------

export type FactoryAnswers = { processes: ProcessCode[]; materials: MaterialCode[]; machines: StartMachine[]; products: string[] };
export type FactoryDelta = { processes: ProcessCode[]; materials: MaterialCode[]; machines: { process: ProcessCode; count: number; size: string }[]; products: string[] };
export type ProductAnswers = { name: string; desc: string; material: string; use: string; weight: string; size: string };
export type ProductDelta = { name?: string; material?: string; use?: string; weight?: string; size?: string };

export const MAX_MACHINES = 30;
export const MAX_PRODUCTS = 20;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const emptyFactoryDelta = (): FactoryDelta => ({ processes: [], materials: [], machines: [], products: [] });
export const isEmptyFactoryDelta = (d: FactoryDelta) => !d.processes.length && !d.materials.length && !d.machines.length && !d.products.length;
export const isEmptyProductDelta = (d: ProductDelta) => !Object.values(d).some(Boolean);

/**
 * Adds what the rows say to the answers. A process or material already chosen stays as it is; a machine count is a target, not a
 * sum, so saying "3 injection machines" twice still gives 3; a machine without a size gets the size when it is said later.
 */
export function mergeFactory(cur: FactoryAnswers, rows: VoiceRow[]): { next: FactoryAnswers; delta: FactoryDelta } {
  const processes = [...cur.processes];
  const materials = [...cur.materials];
  const machines: StartMachine[] = cur.machines.map((m) => ({ ...m }));
  const products = [...cur.products];
  const delta = emptyFactoryDelta();
  const addProcess = (c: ProcessCode) => {
    if (!processes.includes(c)) {
      processes.push(c);
      delta.processes.push(c);
    }
  };
  for (const r of rows) {
    if (r.kind === "process") addProcess(r.code as ProcessCode);
    else if (r.kind === "material") {
      const c = r.code as MaterialCode;
      if (!materials.includes(c)) {
        materials.push(c);
        delta.materials.push(c);
      }
    } else if (r.kind === "machine") {
      const p = r.process as ProcessCode;
      addProcess(p);
      const size = r.size.trim();
      let need: number;
      let added = 0;
      if (size) {
        need = r.count - machines.filter((m) => m.processCode === p && norm(m.size) === norm(size)).length;
        for (const m of machines) {
          if (need <= 0) break;
          if (m.processCode === p && !m.size.trim()) {
            m.size = size;
            added++;
            need--;
          }
        }
      } else need = r.count - machines.filter((m) => m.processCode === p).length;
      while (need > 0 && machines.length < MAX_MACHINES) {
        machines.push({ processCode: p, size });
        added++;
        need--;
      }
      if (added) {
        const same = delta.machines.find((d) => d.process === p && norm(d.size) === norm(size));
        if (same) same.count += added;
        else delta.machines.push({ process: p, count: added, size });
      }
    } else if (r.kind === "product") {
      const name = r.name.trim().slice(0, 80);
      if (name.length >= 2 && products.length < MAX_PRODUCTS && !products.some((x) => norm(x) === norm(name))) {
        products.push(name);
        delta.products.push(name);
      }
    }
  }
  return { next: { processes, materials, machines, products }, delta };
}

/** The same machines, grouped by kind and size, for the summary chips. */
export function groupMachines(machines: StartMachine[]): { process: ProcessCode; size: string; count: number }[] {
  const out: { process: ProcessCode; size: string; count: number }[] = [];
  for (const m of machines) {
    const g = out.find((x) => x.process === m.processCode && norm(x.size) === norm(m.size));
    if (g) g.count++;
    else out.push({ process: m.processCode, size: m.size.trim(), count: 1 });
  }
  return out;
}

export type FactoryItem = { kind: "process"; code: ProcessCode } | { kind: "material"; code: MaterialCode } | { kind: "machines"; process: ProcessCode; size: string } | { kind: "product"; name: string };

/** The person removing a chip from the summary. Removing a process also removes its machines, which would not count without it. */
export function removeFactoryItem(a: FactoryAnswers, item: FactoryItem): FactoryAnswers {
  switch (item.kind) {
    case "process":
      return { ...a, processes: a.processes.filter((c) => c !== item.code), machines: a.machines.filter((m) => m.processCode !== item.code) };
    case "material":
      return { ...a, materials: a.materials.filter((c) => c !== item.code) };
    case "machines":
      return { ...a, machines: a.machines.filter((m) => !(m.processCode === item.process && norm(m.size) === norm(item.size))) };
    case "product":
      return { ...a, products: a.products.filter((n) => n !== item.name) };
  }
}

/** What is still unanswered. Only processes are needed for the first matches; the rest only sharpen them. */
export function factoryMissing(a: FactoryAnswers): ("processes" | "materials" | "machines")[] {
  return [!a.processes.length ? "processes" : null, !a.materials.length ? "materials" : null, !a.machines.length ? "machines" : null].filter((x): x is "processes" | "materials" | "machines" => !!x);
}
export const isFactoryReady = (a: FactoryAnswers) => a.processes.length > 0;

// ---- reading an answer without AI ------------------------------------------------------------------------------------------------

const COUNT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "એક": 1, "બે": 2, "ત્રણ": 3, "ચાર": 4, "પાંચ": 5, "છ": 6, "સાત": 7, "આઠ": 8, "નવ": 9, "દસ": 10,
};
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(tonnes?|tons?|t|kg\s*\/\s*h(?:our)?|kg\s*per\s*hour|टन|ટન)(?![\p{L}\p{M}\p{N}])/giu;

/** Machine sizes written in the note, in the units the platform reads ("150 tonnes", "80 kg/h"). */
export function sizesIn(text: string): string[] {
  return [...text.matchAll(SIZE_RE)].map((m) => (/^kg/i.test(m[2]) ? `${m[1]} kg/h` : `${m[1]} tonnes`));
}

const firstCount = (text: string): number | null => {
  for (const w of text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/)) {
    if (/^\d{1,3}$/.test(w) && Number(w) >= 1) return Number(w);
    if (w in COUNT_WORDS) return COUNT_WORDS[w];
  }
  return null;
};

/** Product names from a short list: "storage crates, buckets and caps". Nothing is guessed beyond splitting the list. */
export function splitProductNames(text: string): string[] {
  return text
    .split(/[\n,;]|\s+and\s+|\s+और\s+|\s+અને\s+/i)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 2 && s.length <= 80)
    .slice(0, MAX_PRODUCTS);
}

/**
 * Plain-matching fallback for a factory answer. It reuses the platform's own word matcher and adds only two things that matter
 * in a conversation: a size said with a machine ("150 tonnes"), and a bare count when only one process is known ("3").
 */
export function fallbackFactoryRows(question: QuestionId | "edit", text: string, cur: FactoryAnswers): VoiceRow[] {
  if (question === "products") return splitProductNames(text).map((name) => ({ kind: "product", name, quote: null }));
  const rows = localExtractFactory(text);
  // "do" is the Hindi/Gujarati-romanised word for two, but also plain English ("we do extrusion"). Without a machine word nearby it is not a count.
  const lowered = text.toLowerCase();
  if (/\bdo\b/.test(lowered) && !/\b2\b|\btwo\b|दो|બે|machine|mashin|मशीन|મશીન|extruder|एक्सट्रूडर/.test(lowered)) {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].kind === "machine" && (rows[i] as { count: number }).count === 2) rows.splice(i, 1);
  }
  const machineRows = rows.filter((r): r is Extract<VoiceRow, { kind: "machine" }> => r.kind === "machine");
  const sizes = sizesIn(text);
  if (question === "machines" || question === "edit") {
    if (machineRows.length === 1 && sizes.length === 1 && !machineRows[0].size) machineRows[0].size = sizes[0];
    if (!machineRows.length) {
      const named = rows.filter((r): r is Extract<VoiceRow, { kind: "process" }> => r.kind === "process");
      const only: ProcessCodeV | null = named.length === 1 ? named[0].code : !named.length && cur.processes.length === 1 ? (cur.processes[0] as ProcessCodeV) : null;
      const count = firstCount(text.replace(SIZE_RE, " "));
      if (only && (count || sizes.length === 1)) rows.push({ kind: "machine", process: only, count: count ?? (cur.machines.filter((m) => m.processCode === only && !m.size.trim()).length || 1), size: sizes.length === 1 ? sizes[0] : "", quote: null });
    }
  }
  return rows;
}

// ---- product answers ---------------------------------------------------------------------------------------------------------------

// Stored as written, because the value is saved with the product (the screen translates it where it is shown).
export const PRODUCT_MATERIALS = ["PP", "HDPE", "LDPE", "PET", "Another material", "I don't know"] as const;
const UNKNOWN = "I don't know";

export function normaliseMaterial(v: string): string {
  const s = v.trim();
  if (!s) return "";
  const up = s.toUpperCase();
  return (PRODUCT_MATERIALS as readonly string[]).includes(up) ? up : (PRODUCT_MATERIALS as readonly string[]).includes(s) ? s : "Another material";
}

export type ProductAi = { name?: string; material?: string; use?: string; weightKg?: string };

/** What the AI's "field" rows say, in the product flow's own terms. */
export function productAiFromRows(rows: VoiceRow[]): ProductAi {
  const out: ProductAi = {};
  for (const r of rows) {
    if (r.kind !== "field") continue;
    if (r.key === "name") out.name = r.value;
    else if (r.key === "material") out.material = normaliseMaterial(r.value);
    else if (r.key === "intended_use") out.use = r.value;
    else if (r.key === "unit_weight_g" && Number(r.value) > 0) out.weightKg = String(Number(r.value) / 1000);
  }
  return out;
}

const blank = (v: string) => !v.trim() || v === UNKNOWN;

/** The first answer: the product's name. A name already there is never replaced. */
export function setProductName(cur: ProductAnswers, text: string): { next: ProductAnswers; delta: ProductDelta } {
  const name = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (name.length < 2 || cur.name.trim()) return { next: cur, delta: {} };
  return { next: { ...cur, name }, delta: { name } };
}

/**
 * Adds a free-text description. The text is kept (after what is there) so the form reads the same words; the plain reader and,
 * when given, the AI fill only what is still blank. `askedUse` makes a short free answer the product's use when nothing else says it.
 */
export function mergeProduct(cur: ProductAnswers, input: { text?: string; ai?: ProductAi; askedUse?: boolean }): { next: ProductAnswers; delta: ProductDelta } {
  const text = (input.text ?? "").trim();
  const desc = text ? [cur.desc.trim(), text].filter(Boolean).join("\n").slice(0, 2000) : cur.desc;
  const rows = readProduct(cur.name, desc);
  const v = (k: ReadRow["key"]) => rows.find((r) => r.key === k)?.value ?? "";
  const next: ProductAnswers = { ...cur, desc };
  const delta: ProductDelta = {};
  const fill = (key: "material" | "use" | "weight" | "size", value: string) => {
    const x = value.trim();
    if (!x || (key === "material" && x === UNKNOWN) || !blank(next[key])) return;
    next[key] = x;
    delta[key] = x;
  };
  fill("material", v("material"));
  fill("use", v("use"));
  fill("weight", v("weightKg"));
  fill("size", v("size"));
  if (input.ai) {
    fill("material", input.ai.material ?? "");
    fill("use", input.ai.use ?? "");
    fill("weight", input.ai.weightKg ?? "");
  }
  if (input.askedUse && blank(next.use) && text) {
    const words = text.replace(/\b(?:hdpe|ldpe|pp|pet|polypropylene)\b/gi, " ").replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
    if (words.length >= 3) fill("use", words.slice(0, 120));
  }
  return { next, delta };
}

export const productMissing = (a: ProductAnswers): ("material" | "use" | "weight" | "size")[] =>
  (["material", "use", "weight", "size"] as const).filter((k) => blank(a[k]));
export const isProductReady = (a: ProductAnswers) => a.name.trim().length >= 2;

/** The one follow-up question, only about what is still missing among material and use. */
export function productFollowUp(a: ProductAnswers): "both" | "material" | "use" | null {
  const m = blank(a.material);
  const u = blank(a.use);
  return m && u ? "both" : m ? "material" : u ? "use" : null;
}

export function clearProductField(a: ProductAnswers, key: "material" | "use" | "weight" | "size"): ProductAnswers {
  return { ...a, [key]: "" };
}

/** The rows the product flow's "Here is what we found" step shows, built from the chat's answers. */
export function productRows(a: ProductAnswers): ReadRow[] {
  const read = readProduct(a.name, a.desc);
  const found = (k: ReadRow["key"]) => read.find((r) => r.key === k)?.value ?? "";
  const row = (key: ReadRow["key"], label: string, value: string, status: ReadRow["status"]): ReadRow => ({ key, label, value, status: value ? status : "missing" });
  const material = a.material === UNKNOWN ? "" : a.material;
  return [
    row("name", "Product", a.name.trim(), "found"),
    row("material", "Material", material, found("material") === material ? "found" : "guess"),
    row("use", "Intended use", a.use, "guess"),
    row("weightKg", "Weight (kg)", a.weight, "found"),
    row("size", "Size (mm)", a.size, "found"),
  ];
}

// ---- what the bot says -----------------------------------------------------------------------------------------------------------

export const TEMPLATES = {
  gotIt: "Got it: {items}.",
  nothingNew: "I did not find anything new in that. You can say it another way, or skip this question.",
  machine1: "{count} {process} machine",
  machineN: "{count} {process} machines",
  machine1Size: "{count} {process} machine of {size}",
  machineNSize: "{count} {process} machines of {size}",
  madeOf: "made of {material}",
  usedFor: "used for {use}",
  weighs: "weighs {weight} kg",
  sized: "size {size} mm",
  named: "the product is called {name}",
  noteAiOff: "I read this with simple word matching because the AI service is not available. Please check it.",
  noteNoConsent: "I read this with simple word matching, as you chose. Please check it.",
  noteAfterFailure: "I read this with simple word matching instead. Please check it.",
  needProcess: "I still need at least one process to show matches. Use “Add or change something” to tell me one.",
  stillMissing: "Still missing: {items}. That is okay, you can add it later.",
  missingMaterial: "material",
  missingUse: "what it is used for",
  missingWeight: "weight",
  missingSize: "size",
  missingMaterials: "plastics",
  missingMachines: "machines",
} as const;

/** Every English sentence this module can produce, so the translation test can check them all. */
export const CHAT_TEMPLATES: string[] = [
  ...Object.values(TEMPLATES),
  ...Object.values(QUESTIONS).flatMap((q) => [q.text, q.placeholder, ...q.chips.filter((c) => !c.plain).map((c) => c.label)]),
];

/** "Got it: 3 injection moulding machines, PP, HDPE." Returns null when nothing new was found. */
export function describeFactoryDelta(d: FactoryDelta, s: Say): string | null {
  const items: string[] = [];
  const covered = new Set<string>();
  for (const m of d.machines) {
    covered.add(m.process);
    const key = m.size ? (m.count === 1 ? TEMPLATES.machine1Size : TEMPLATES.machineNSize) : m.count === 1 ? TEMPLATES.machine1 : TEMPLATES.machineN;
    items.push(s.t(key, { count: m.count, process: s.process(m.process).toLowerCase(), size: m.size }));
  }
  for (const p of d.processes) if (!covered.has(p)) items.push(s.process(p));
  for (const m of d.materials) items.push(s.material(m));
  for (const p of d.products) items.push(p);
  return items.length ? s.t(TEMPLATES.gotIt, { items: items.join(", ") }) : null;
}

export function describeProductDelta(d: ProductDelta, s: Say): string | null {
  const items: string[] = [];
  if (d.name) items.push(s.t(TEMPLATES.named, { name: d.name }));
  if (d.material) items.push(s.t(TEMPLATES.madeOf, { material: s.t(d.material) }));
  if (d.use) items.push(s.t(TEMPLATES.usedFor, { use: s.t(d.use) }));
  if (d.weight) items.push(s.t(TEMPLATES.weighs, { weight: d.weight }));
  if (d.size) items.push(s.t(TEMPLATES.sized, { size: d.size }));
  return items.length ? s.t(TEMPLATES.gotIt, { items: items.join(", ") }) : null;
}

/** The sentence under the summary card: what is still missing, or null when nothing important is. */
export function describeMissing(path: Path, factory: FactoryAnswers, product: ProductAnswers, t: Say["t"]): string | null {
  if (path === "factory") {
    if (!factory.processes.length) return t(TEMPLATES.needProcess);
    const label = { processes: "", materials: TEMPLATES.missingMaterials, machines: TEMPLATES.missingMachines } as const;
    const items = factoryMissing(factory).map((k) => (label[k] ? t(label[k]) : "")).filter(Boolean);
    return items.length ? t(TEMPLATES.stillMissing, { items: items.join(", ") }) : null;
  }
  const label = { material: TEMPLATES.missingMaterial, use: TEMPLATES.missingUse, weight: TEMPLATES.missingWeight, size: TEMPLATES.missingSize } as const;
  const items = productMissing(product).map((k) => t(label[k]));
  return items.length ? t(TEMPLATES.stillMissing, { items: items.join(", ") }) : null;
}

/** English-only rendering used by tests and as a safe default. */
export const englishSay: Say = {
  t: (s, v) => interpolate(s, v),
  process: (c) => c.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()),
  material: (c) => c,
};

export type { ProcessCodeV, MaterialCodeV };

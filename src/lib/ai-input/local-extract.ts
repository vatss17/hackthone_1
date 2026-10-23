import type { MaterialCodeV, ProcessCodeV, VoiceRow } from "./voice.ts";

/**
 * A deterministic fallback for "find the fields in this note" that needs no AI, no key and no network. It only looks for
 * words it knows (processes, polymer names, number words, in English, Hindi and Gujarati, including romanised spellings) and
 * reports exactly what it matched. It never guesses: anything it does not recognise is left for the person to type.
 */

const PROCESS_WORDS: Record<ProcessCodeV, string[]> = {
  injection_moulding: ["injection moulding", "injection molding", "injection", "इंजेक्शन मोल्डिंग", "इंजेक्शन", "ઇન્જેક્શન મોલ્ડિંગ", "ઇન્જેક્શન", "ઈન્જેક્શન"],
  blow_moulding: ["blow moulding", "blow molding", "blow mould", "ब्लो मोल्डिंग", "ब्लो", "બ્લો મોલ્ડિંગ", "બ્લો"],
  extrusion: ["extrusion", "extruder", "एक्सट्रूज़न", "एक्सट्रूजन", "एक्सट्रूडर", "એક્સ્ટ્રુઝન", "એક્સ્ટ્રુડર"],
  thermoforming: ["thermoforming", "थर्मोफॉर्मिंग", "થર્મોફોર્મિંગ"],
  rotational_moulding: ["rotational moulding", "rotational molding", "rotomoulding", "rotomolding", "रोटेशनल मोल्डिंग", "રોટેશનલ મોલ્ડિંગ"],
  compression_moulding: ["compression moulding", "compression molding", "कम्प्रेशन मोल्डिंग", "કમ્પ્રેશન મોલ્ડિંગ"],
  additive_manufacturing: ["3d printing", "additive manufacturing", "3डी प्रिंटिंग", "૩ડી પ્રિન્ટિંગ"],
  printing: ["printing", "प्रिंटिंग", "પ્રિન્ટિંગ"],
  finishing: ["finishing", "फिनिशिंग", "ફિનિશિંગ"],
};

const MATERIAL_WORDS: Record<MaterialCodeV, string[]> = {
  PP: ["pp", "polypropylene", "पीपी", "पॉलीप्रोपिलीन", "પીપી", "પોલીપ્રોપિલીન"],
  HDPE: ["hdpe", "एचडीपीई", "એચડીપીઈ"],
  LDPE: ["ldpe", "एलडीपीई", "એલડીપીઈ"],
  LLDPE: ["lldpe", "एलएलडीपीई", "એલએલડીપીઈ"],
  PET: ["pet", "पेट", "પેટ"],
  PVC: ["pvc", "पीवीसी", "પીવીસી"],
  PS: ["ps", "polystyrene", "पीएस", "પીએસ"],
  HIPS: ["hips", "हिप्स", "હિપ્સ"],
  ABS: ["abs", "एबीएस", "એબીએસ"],
  PC: ["pc", "polycarbonate", "पॉलीकार्बोनेट", "પોલીકાર્બોનેટ"],
  PA: ["nylon", "polyamide", "नायलॉन", "નાયલોન"],
  PMMA: ["pmma", "acrylic", "एक्रिलिक", "એક્રેલિક"],
  TPE: ["tpe"],
  TPU: ["tpu"],
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "એક": 1, "બે": 2, "ત્રણ": 3, "ચાર": 4, "પાંચ": 5, "છ": 6, "સાત": 7, "આઠ": 8, "નવ": 9, "દસ": 10,
};

const lower = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ");
const hasWord = (text: string, word: string): boolean => {
  const re = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{M}\\p{N}])`, "u");
  return re.test(text);
};

/** Finds a process mentioned in the note. The longest matching phrase wins, so "injection moulding" beats "injection". */
function processesIn(text: string): { code: ProcessCodeV; at: number; word: string }[] {
  const found: { code: ProcessCodeV; at: number; word: string }[] = [];
  for (const [code, words] of Object.entries(PROCESS_WORDS) as [ProcessCodeV, string[]][]) {
    const best = [...words].sort((a, b) => b.length - a.length).find((w) => hasWord(text, w.toLowerCase()));
    if (best) found.push({ code, at: text.indexOf(best.toLowerCase()), word: best });
  }
  return found;
}

/** A count written near a process word, within a few words before it: "three injection moulding machines", "3 extruders". */
function countBefore(text: string, at: number): number | null {
  const before = text.slice(Math.max(0, at - 40), at).trim().split(" ").slice(-3);
  for (const w of before.reverse()) {
    if (/^\d{1,3}$/.test(w)) return Number(w);
    if (w in NUMBER_WORDS) return NUMBER_WORDS[w];
  }
  const after = text.slice(at).split(" ").slice(2, 5);
  for (const w of after) {
    if (/^\d{1,3}$/.test(w)) return Number(w);
    if (w in NUMBER_WORDS) return NUMBER_WORDS[w];
  }
  return null;
}

export function localExtractFactory(note: string): VoiceRow[] {
  const text = lower(note);
  const rows: VoiceRow[] = [];
  for (const p of processesIn(text)) {
    rows.push({ kind: "process", code: p.code, quote: p.word });
    const count = countBefore(text, p.at);
    if (count && count >= 1) rows.push({ kind: "machine", process: p.code, count, size: "", quote: null });
  }
  for (const [code, words] of Object.entries(MATERIAL_WORDS) as [MaterialCodeV, string[]][]) {
    const w = words.find((x) => hasWord(text, x.toLowerCase()));
    if (w) rows.push({ kind: "material", code, quote: w });
  }
  return rows;
}

export function localExtract(target: "text" | "factory" | "product", note: string): VoiceRow[] {
  return target === "factory" ? localExtractFactory(note) : [];
}

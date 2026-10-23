/**
 * Atlas AI's intent router. A deterministic, explainable match from what the person typed to one of the
 * tools Atlas can actually run. Nothing here calls a model: when a language model is configured it may
 * pick the tool instead (see ./llm.ts), but this router always works and is what the tests pin down.
 */

// The suggested prompts are translated in the atlas section dictionary, so the router can recognise a chip clicked in Hindi or Gujarati.
import { atlas } from "../i18n/messages/atlas.ts";

export type IntentId =
  | "find_opportunities"
  | "explain_blockers"
  | "calculate_landed_cost"
  | "prepare_invoice"
  | "missing_documents"
  | "create_next_tasks"
  | "compare_opportunities"
  | "apply_schemes";

export interface Intent {
  id: IntentId;
  /** The suggested prompt, worded as the person would say it. */
  prompt: string;
  /** What the tool does, in one line, shown before it runs. */
  does: string;
  /** Whether the tool needs a product to work on. */
  needsProduct: boolean;
  /** Whether the tool proposes a change the person must approve before anything is saved. */
  proposesChange: boolean;
  /** Lower-case phrases; the longest matching phrase wins. */
  phrases: string[];
}

export const INTENTS: Intent[] = [
  {
    id: "find_opportunities",
    prompt: "Find export opportunities for my factory",
    does: "Reads your factory profile and runs the opportunity engine over the product catalogue.",
    needsProduct: false,
    proposesChange: false,
    phrases: ["find export opportunit", "find opportunit", "what could i export", "what else could", "what can my factory", "opportunit", "what can i make", "new products",
      // Hindi, Gujarati and the romanised Hinglish / Gujlish people type or say
      "निर्यात के अवसर", "निर्यात अवसर", "अवसर", "नए उत्पाद", "क्या निर्यात कर सकता", "क्या बना सकता",
      "export ke mauke", "niryat ke avsar", "niryat avsar", "avsar", "mauke", "naye product", "kya export kar sakta", "kya bana sakta",
      "નિકાસની તકો", "નિકાસની તક", "નિકાસ તકો", "તકો", "નવા ઉત્પાદન", "શું નિકાસ કરી શકું", "શું બનાવી શકું",
      "export ni tako", "niryat ni tako", "nikas ni tako", "tako", "navi products", "su export kari saku", "su banavi saku"],
  },
  {
    id: "explain_blockers",
    prompt: "Explain what's stopping me from exporting",
    does: "Builds your readiness roadmap for a product and explains each open blocker.",
    needsProduct: true,
    proposesChange: false,
    phrases: ["stopping me", "what is blocking", "what's blocking", "blocker", "why can't i export", "why cant i export", "holding me back", "what is missing to export", "readiness", "am i ready",
      "मुझे क्या रोक रहा", "क्या रोक रहा", "रुकावट", "बाधा", "निर्यात में बाधा", "तैयारी", "क्या मैं तैयार हूँ", "क्या मैं तैयार हूं", "निर्यात क्यों नहीं कर सकता",
      "kya rok raha", "rukawat", "rukavat", "badha", "kyun export nahi", "kyu export nahi", "kya missing hai", "taiyari",
      "મને શું રોકે છે", "શું રોકે", "અવરોધ", "અડચણ", "તૈયારી", "હું તૈયાર છું", "કેમ નિકાસ નથી કરી શકતો",
      "su rokai che", "su roke che", "avrodh", "adchan", "kem export nahi"],
  },
  {
    id: "calculate_landed_cost",
    prompt: "Calculate my landed cost",
    does: "Runs the landed-cost calculator on your saved assessment and reports cost, margin and break-even.",
    needsProduct: true,
    proposesChange: false,
    phrases: ["landed cost", "calculate my cost", "margin", "break-even", "break even", "profit", "economics", "how much will it cost", "cost to ship",
      "लैंडेड कॉस्ट", "लैंडेड कोस्ट", "लैंडेड लागत", "कुल लागत", "मेरी लागत", "मार्जिन", "ब्रेक-ईवन", "ब्रेक ईवन", "मुनाफ़ा", "मुनाफा", "भेजने की लागत", "कितना खर्च", "कितनी लागत",
      "landed cost kitna", "landed cost kitni", "kitna kharcha", "kitna kharch", "kitni lagat", "lagat", "margin kitna", "munafa", "profit kitna", "shipping cost",
      "લેન્ડેડ કોસ્ટ", "લેન્ડેડ ખર્ચ", "કુલ ખર્ચ", "મારો ખર્ચ", "માર્જિન", "બ્રેક-ઈવન", "બ્રેક ઈવન", "નફો", "કેટલો ખર્ચ", "મોકલવાનો ખર્ચ",
      "landed cost ketlo", "ketlo kharcho", "ketlo kharch", "nafo", "margin ketlu"],
  },
  {
    id: "prepare_invoice",
    prompt: "Prepare my commercial invoice",
    does: "Fills a commercial invoice draft from your company, product and calculator, and lists what is still empty.",
    needsProduct: true,
    proposesChange: false,
    phrases: ["commercial invoice", "prepare my invoice", "invoice", "proforma",
      "कमर्शियल इनवॉइस", "कमर्शियल इन्वॉइस", "इनवॉइस", "इन्वॉइस", "इनवॉयस", "चालान", "प्रोफ़ॉर्मा", "प्रोफार्मा",
      "invoice banao", "invoice bana", "invoice tayar", "invoice taiyar", "bill banao",
      "કોમર્શિયલ ઇનવૉઇસ", "ઇનવૉઇસ", "ઇન્વૉઇસ", "ઇનવોઇસ", "ઇન્વોઇસ", "બિલ બનાવો", "પ્રોફોર્મા",
      "invoice banavo", "invoice taiyar karo", "bill banavo"],
  },
  {
    id: "missing_documents",
    prompt: "Identify missing documents",
    does: "Checks the document checklist and both drafts for what is missing.",
    needsProduct: true,
    proposesChange: false,
    phrases: ["missing document", "which documents", "what documents", "documents do i need", "paperwork", "documents",
      "कौन से दस्तावेज़", "कौन सा दस्तावेज़", "कौन से कागज़", "बाकी दस्तावेज़", "अधूरे दस्तावेज़", "दस्तावेज़", "दस्तावेज", "कागज़ात", "कागजात", "कागज़ी कार्रवाई", "पेपरवर्क", "डॉक्यूमेंट",
      "kaun se document", "kaunse document", "konse document", "documents chahiye", "document chahiye", "kagaz", "kagzat", "document baki",
      "કયા દસ્તાવેજ", "કયા કાગળ", "બાકી દસ્તાવેજ", "ખૂટતા દસ્તાવેજ", "અધૂરા દસ્તાવેજ", "દસ્તાવેજો", "દસ્તાવેજ", "કાગળો", "કાગળિયા", "પેપરવર્ક",
      "kya document", "kaya document", "documents joiye", "document joiye", "kagal"],
  },
  {
    id: "create_next_tasks",
    prompt: "Create my next five tasks",
    does: "Picks the five most important open roadmap steps and proposes adding them to your plan. Nothing is saved until you approve.",
    needsProduct: true,
    proposesChange: true,
    phrases: ["next five tasks", "next 5 tasks", "create my next", "create tasks", "plan my week", "what should i do next", "next steps", "to-do", "todo",
      "अगले पाँच कार्य", "अगले पांच कार्य", "अगले 5 कार्य", "अगले पाँच काम", "अगले पांच काम", "अगले 5 काम", "अगले कदम", "अगले चरण", "क्या करना चाहिए", "आगे क्या करूँ", "आगे क्या करूं", "कार्य बनाओ", "कार्य बनाएँ", "कार्य बनाएं", "टास्क", "सप्ताह की योजना", "हफ्ते की योजना", "योजना बनाओ",
      "agle paanch kaam", "agle 5 kaam", "agle paanch task", "aage kya karu", "aage kya karun", "kya karna chahiye", "task banao", "tasks banao", "kaam banao", "agle kadam", "agla step", "hafte ka plan",
      "આગામી પાંચ કાર્ય", "આગળના પાંચ કાર્ય", "આગામી 5 કાર્ય", "આગામી પાંચ કામ", "આગળ શું કરવું", "હવે શું કરું", "આગામી પગલાં", "આગળનાં પગલાં", "કાર્યો બનાવો", "ટાસ્ક", "અઠવાડિયાનું આયોજન",
      "aagal su karvu", "have su karu", "agla paanch kaam", "aavta panch kaam", "task banavo", "tasks banavo", "kaam banavo", "aagla step"],
  },
  {
    id: "compare_opportunities",
    prompt: "Compare these opportunities",
    does: "Lines up your strongest opportunities side by side: fit, what you already have and what is missing.",
    needsProduct: false,
    proposesChange: false,
    phrases: ["compare opportunit", "compare these", "compare", "side by side", "which is better", "which opportunity", "rank",
      "अवसरों की तुलना", "तुलना", "इनकी तुलना", "कौन सा बेहतर", "कौन सा अवसर", "आमने-सामने", "रैंक",
      "tulna", "opportunities ki tulna", "opportunity ki tulna", "kaun sa behtar", "kaunsa behtar", "kaun sa opportunity", "compare karo",
      "તકોની સરખામણી", "સરખામણી", "કયું સારું", "કઈ તક", "રેન્ક",
      "sarkhamani", "sarkhaman", "opportunities ni sarkhamani", "opportunity ni sarkhamani", "kayu saru", "kai tak"],
  },
  {
    id: "apply_schemes",
    prompt: "Help me apply for relevant schemes",
    does: "Lists the Indian export schemes worth checking for a product, with researched answers and sources, and proposes the steps as tasks. Atlas applies for nothing.",
    needsProduct: true,
    proposesChange: true,
    phrases: ["scheme", "incentive", "rodtep", "drawback", "advance authorisation", "advance authorization", "subsid", "benefit",
      "योजना के लिए आवेदन", "सरकारी योजना", "निर्यात योजना", "योजनाओं", "योजनाएँ", "योजनाएं", "प्रोत्साहन", "सब्सिडी", "अनुदान", "ड्रॉबैक", "आरओडीटीईपी", "एडवांस ऑथराइज़ेशन",
      "yojana", "yojna", "sarkari yojana",
      "યોજના માટે અરજી", "સરકારી યોજના", "નિકાસ યોજના", "યોજનાઓ", "પ્રોત્સાહન", "સબસિડી", "ડ્રોબેક", "આરઓડીટીઈપી",
      "yojnao"],
  },
];

export const INTENT_BY_ID = Object.fromEntries(INTENTS.map((i) => [i.id, i])) as Record<IntentId, Intent>;

// NFC so a nukta typed as one character or as two (ज़) compares equal.
const normalise = (s: string) => s.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

/** The tool for a sentence, or null when nothing matches well enough to run anything. */
export function routeIntent(text: string): { intent: Intent; matched: string } | null {
  const t = normalise(text);
  if (!t) return null;
  // An exact suggested prompt always wins, in English or as the interface shows it in Hindi or Gujarati.
  const exact = INTENTS.find((i) => [i.prompt, atlas.hi[i.prompt], atlas.gu[i.prompt]].some((x) => x && normalise(x) === t));
  if (exact) return { intent: exact, matched: exact.prompt };
  let best: { intent: Intent; matched: string } | null = null;
  for (const intent of INTENTS) {
    for (const phrase of intent.phrases) {
      const p = normalise(phrase);
      if (t.includes(p) && (!best || p.length > best.matched.length)) best = { intent, matched: p };
    }
  }
  return best;
}

/** A product the sentence names, matched on whole words of the product name (at least one word of four letters or more). */
export function mentionedProduct<T extends { name: string }>(text: string, products: T[]): T | null {
  const t = ` ${normalise(text).replace(/[^a-z0-9 ]/g, " ")} `;
  let best: { p: T; hits: number } | null = null;
  for (const p of products) {
    const words = normalise(p.name).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length >= 4);
    const hits = words.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { p, hits };
  }
  return best?.p ?? null;
}

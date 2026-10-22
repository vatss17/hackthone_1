/**
 * First-pass compliance and incentives screening content for four plastic product families.
 *
 * HONESTY RULES (enforced by tests/compliance):
 *  - No item here states what the law requires, a customs rate, an incentive amount or an
 *    eligibility decision. Items are SCREENING QUESTIONS.
 *  - Each item carries an evidence class. Nothing is "verified": the official primary sources
 *    could not be opened during this sprint (see SOURCES), so the few concrete facts used are
 *    "secondary source" and need primary confirmation.
 *  - HS headings listed are candidates for a classifier to consider, never a classification.
 */

export type Evidence = "verified" | "secondary" | "user" | "inferred" | "assumption" | "unknown";

export interface Source {
  id: string;
  fact: string;
  /** Who is said to publish the fact. */
  publisher: string;
  /** Where we looked. Every URL was returned by a web search on the retrieval date. */
  url: string;
  retrieved: string;
  /** Whether the primary (official) text was opened by us. It was not. */
  primaryOpened: boolean;
  caveat: string;
}

export const RETRIEVED = "2026-10-22";

export const SOURCES: Source[] = [
  {
    id: "cepa-in-force",
    fact: "The India–UAE Comprehensive Economic Partnership Agreement came into effect on 1 May 2022 (signed 18 February 2022).",
    publisher: "Ministry of Commerce and Industry, Government of India (reported on commerce.gov.in); corroborated by PwC Middle East",
    url: "https://www.pwc.com/m1/en/tax/documents/2022/the-uae-india-comprehensive-economic-partnership-agreement-enters-into-force.pdf",
    retrieved: RETRIEVED,
    primaryOpened: false,
    caveat: "The Ministry page (commerce.gov.in/?p=17094) was returned by search but could not be opened (HTTP 403). Confirm on the Ministry or PIB site and read the agreement text for the rules of origin.",
  },
  {
    id: "uae-duty-general",
    fact: "Several trade guides state that UAE customs duty is generally 5% of CIF value for most goods, with exceptions for some products.",
    publisher: "Secondary trade guides; Sharjah Customs publishes a tariff page",
    url: "https://sharjahcustoms.gov.ae/en/customs-tariff",
    retrieved: RETRIEVED,
    primaryOpened: false,
    caveat: "No federal authority page was retrieved. The rate for your product depends on its tariff line. Confirm with UAE customs or a customs broker.",
  },
  {
    id: "uae-vat",
    fact: "UAE VAT is reported to be 5% and to apply to imports as well as local supplies.",
    publisher: "Secondary guidance (Federal Decree-Law No. 8 of 2017 is the law cited)",
    url: "https://roedl.com/insights/vat-guidelines/united-arab-emirates-rate-registration-declaration-requirements",
    retrieved: RETRIEVED,
    primaryOpened: false,
    caveat: "The Federal Tax Authority site was not retrieved. Import VAT is excluded from the landed-cost calculator because a VAT-registered importer can normally recover it: confirm with an adviser.",
  },
  {
    id: "rodtep",
    fact: "RoDTEP (Remission of Duties and Taxes on Exported Products) is an Indian scheme administered by DGFT that refunds embedded taxes through transferable duty credit e-scrips. Rates and value caps are set by DGFT notifications and have been revised, including a reported February 2026 change.",
    publisher: "DGFT notifications, as reported by EY India",
    url: "https://www.ey.com/en_in/technical/alerts-hub/2026/02/dgft-restricts-rodtep-benefits-to-50pc-of-notified-rates-and-value-caps-on-exported-products",
    retrieved: RETRIEVED,
    primaryOpened: false,
    caveat: "The DGFT notifications were not opened. No rate or amount is stated anywhere in this platform. Check the current notification and Appendix for your product's tariff item.",
  },
];

export const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export interface Item {
  id: string;
  text: string;
  why: string;
  evidence: Evidence;
  sourceId?: string;
}

export type SectionKey = "indianExport" | "uaeImport" | "testing" | "packaging" | "hs" | "cepa" | "schemes";

export const SECTION_TITLES: Record<SectionKey, { title: string; blurb: string }> = {
  indianExport: { title: "Indian export checks", blurb: "Things an Indian exporter typically has to settle before goods leave India." },
  uaeImport: { title: "UAE import checks", blurb: "Questions about what the UAE side may require of the product and the importer." },
  testing: { title: "Testing and certification questions", blurb: "Evidence a buyer or authority may ask for." },
  packaging: { title: "Packaging and labelling", blurb: "How the product is packed, marked and described." },
  hs: { title: "HS classification", blurb: "Duty, origin and many requirements depend on the product code. Nothing here is a classification." },
  cepa: { title: "India–UAE CEPA: rules-of-origin questions", blurb: "Whether the product could qualify for preferential treatment depends on origin rules. This platform does not decide eligibility." },
  schemes: { title: "Indian export schemes to investigate", blurb: "Schemes that may be relevant. No amount or eligibility is stated." },
};

export interface Family {
  id: string;
  name: string;
  covers: string;
  entryIds: string[];
  /** Candidate HS headings for a classifier to consider. Inference only. */
  hsCandidates: { heading: string; description: string }[];
  sections: Record<SectionKey, Item[]>;
}

const i = (id: string, text: string, why: string, evidence: Evidence = "unknown", sourceId?: string): Item => ({ id, text, why, evidence, sourceId });

/** Questions that apply to every family. Shown first on every product. */
const COMMON: Pick<Record<SectionKey, Item[]>, "indianExport" | "uaeImport" | "cepa" | "schemes"> = {
  indianExport: [
    i("common.iec", "Do you hold a valid Importer-Exporter Code (IEC), and is one needed for your exports?", "Most export steps are tied to it. Confirm the requirement with DGFT."),
    i("common.gst", "How will GST on this export be handled (for example under a letter of undertaking or by refund)?", "It affects cash flow and the real cost of the export. A tax adviser should confirm."),
    i("common.docs", "Who will file the shipping bill and handle export customs clearance?", "A customs broker or freight forwarder usually does this. Confirm who and at what cost."),
    i("common.rcmc", "Should you register with the export promotion council for plastics?", "Membership certificates are often needed to claim certain benefits. Confirm with the council."),
  ],
  uaeImport: [
    i("common.importer", "Who is the importer of record in the UAE, and do they hold the trade licence and customs registration needed to import this product?", "The importer carries many of the UAE-side obligations."),
    i("common.technical", "Is this product covered by a UAE or GCC technical regulation or conformity scheme?", "This decides whether certificates or product registration are needed. It has not been checked."),
    i("common.duty", "What customs duty applies to this product's tariff line?", "Trade guides report a general rate (see the sources below) but your tariff line may differ.", "secondary", "uae-duty-general"),
    i("common.vat", "Will the importer be VAT-registered, so import VAT is recoverable?", "Import VAT is excluded from the calculator on that basis. Confirm with an adviser.", "secondary", "uae-vat"),
  ],
  cepa: [
    i("common.cepa.rule", "Which origin rule applies to your product's HS heading under the CEPA (for example a change of tariff heading or a regional value content test)?", "Preference depends on meeting the product-specific rule. It has not been checked."),
    i("common.cepa.inputs", "How much of your product's value is from non-Indian inputs, and where is your polymer made?", "Imported resin or additives can decide whether origin is met."),
    i("common.cepa.proof", "Could you document your costs and inputs well enough to prove origin if asked?", "Origin claims are normally backed by cost and input records."),
    i("common.cepa.cert", "Who issues the CEPA certificate of origin, how long does it take, and what does it cost?", "The process and evidence required are set by the authorities. Confirm the current procedure."),
    i("common.cepa.fact", "Background: the CEPA is reported to have come into effect on 1 May 2022.", "Context only. It does not mean your product qualifies.", "secondary", "cepa-in-force"),
  ],
  schemes: [
    i("common.rodtep", "RoDTEP: could your product's tariff item be covered, and at what current rate and cap?", "Rates and caps are set by DGFT notifications and have been revised. No figure is stated here.", "secondary", "rodtep"),
    i("common.drawback", "Duty drawback: do you pay customs duty on imported inputs that could be refunded on export?", "Relevant if you import resin or additives. Confirm with a customs adviser."),
    i("common.aa", "Advance Authorisation: would importing inputs duty-free against an export obligation suit your volumes?", "It carries obligations and paperwork. An adviser should confirm fit."),
    i("common.state", "Are there state-level export incentives for your location?", "These vary by state and change often."),
  ],
};

export const FAMILIES: Family[] = [
  {
    id: "food-contact",
    name: "Food-contact plastic products",
    covers: "Containers, tableware, bottles, closures and trays that touch food or drink.",
    entryIds: ["food-storage-containers", "food-service-ware", "thermoformed-trays", "blow-moulded-bottles", "caps-and-closures"],
    hsCandidates: [
      { heading: "3923", description: "Articles for the conveyance or packing of goods, stoppers, lids and caps, of plastics" },
      { heading: "3924", description: "Tableware, kitchenware and other household articles of plastics" },
    ],
    sections: {
      indianExport: [i("fc.ex.food", "Does exporting a food-contact product bring any extra Indian export check, such as an inspection or quality requirement?", "Some categories have export-specific rules. Confirm with the relevant authority.")],
      uaeImport: [
        i("fc.uae.contact", "Which food-contact requirements apply to plastic articles imported into the UAE, and against which standard must materials be shown suitable?", "Food-contact suitability is typically the first gate for these products."),
        i("fc.uae.single", "Do rules on single-use plastics reach this product, or is a reusable product outside them?", "Restrictions on some single-use items have been introduced in parts of the UAE. Applicability must be checked against official sources."),
        i("fc.uae.regis", "Is any registration or approval of the product or the importer needed for food-contact goods?", "Some jurisdictions register food-contact articles. Confirm for the UAE."),
      ],
      testing: [
        i("fc.test.migration", "Do you hold migration test reports for the exact material and colourants, from an accredited laboratory?", "Buyers usually ask for them. The test method that applies must be confirmed."),
        i("fc.test.grade", "Can your resin and masterbatch suppliers give food-contact declarations for each grade you use?", "Supplier declarations are normally part of the evidence file."),
        i("fc.test.claims", "Do you make claims such as microwave-safe, dishwasher-safe or BPA-free, and can you evidence each?", "Each claim needs its own evidence."),
        i("fc.test.recycled", "Is any recycled material used? If so, is it acceptable for food contact?", "Recycled content in food-contact products is tightly controlled in many markets."),
      ],
      packaging: [
        i("fc.pack.label", "What must the retail or carton label show, and in which languages (including Arabic)?", "Language and content expectations have not been checked."),
        i("fc.pack.symbol", "Is a food-contact symbol or statement expected on the product or pack?", "Practice differs by market. Confirm for the UAE."),
        i("fc.pack.print", "Are printed or decorated surfaces in contact with food? Are the inks suitable?", "Inks and decoration can change the evidence needed."),
      ],
      hs: [i("fc.hs.which", "Which heading fits: a packing article (3923) or a household or kitchen article (3924), and what is the 8-digit tariff line?", "Both are plausible depending on use and design. A classifier decides.", "inferred")],
      cepa: [],
      schemes: [],
    },
  },
  {
    id: "household-general",
    name: "Household and general consumer plastics",
    covers: "Storage boxes, buckets, hangers, planters, crates, furniture and pallets.",
    entryIds: ["household-storage-boxes", "buckets-and-cleaning-ware", "hangers-and-laundry", "planters-and-nursery", "crates-and-baskets", "stackable-furniture", "industrial-pallets"],
    hsCandidates: [
      { heading: "3924", description: "Tableware, kitchenware and other household articles of plastics" },
      { heading: "3926", description: "Other articles of plastics" },
      { heading: "9403", description: "Other furniture (for plastic furniture)" },
    ],
    sections: {
      indianExport: [i("hg.ex.none", "Is there any product-specific Indian export requirement for general household plastics?", "Usually none beyond the common checks, but this has not been confirmed.")],
      uaeImport: [
        i("hg.uae.conf", "Do general consumer plastics need a conformity certificate in the UAE, or are requirements driven by retail buyers?", "This is the key question for this family and has not been answered."),
        i("hg.uae.child", "Is the product likely to be used by children? If so, do extra safety rules apply?", "Children's use can add requirements."),
      ],
      testing: [
        i("hg.test.mech", "Which mechanical tests will buyers expect (load, stacking, impact, handle pull-out)?", "Buyers usually specify tests for their own range."),
        i("hg.test.uv", "For outdoor products, can you evidence UV and heat ageing performance?", "Strong sun makes this a quality question, whatever the rules say."),
        i("hg.test.furn", "For furniture, do buyers expect strength, stability or flammability test reports?", "Hospitality buyers often ask for them."),
      ],
      packaging: [
        i("hg.pack.label", "What marking and language does the carton and product need (including Arabic)?", "Not yet checked."),
        i("hg.pack.pallet", "If you ship on wooden pallets, is wood-packaging treatment marking needed?", "Wood packaging is commonly regulated internationally. Confirm the requirement."),
        i("hg.pack.nest", "Can the product be nested or stacked to reduce freight cost?", "Carton design changes freight cost directly. See the calculator."),
      ],
      hs: [i("hg.hs.which", "Is the product a household article (3924), an 'other article of plastics' (3926) or furniture (9403), and what is the 8-digit tariff line?", "The use and design decide it. A classifier should confirm.", "inferred")],
      cepa: [],
      schemes: [],
    },
  },
  {
    id: "water-irrigation",
    name: "Pipes, fittings, irrigation and tanks",
    covers: "Extruded pipe and tubing, moulded fittings, drip irrigation and water tanks.",
    entryIds: ["irrigation-drip", "pipes-and-fittings", "rotomoulded-tanks"],
    hsCandidates: [
      { heading: "3917", description: "Tubes, pipes and hoses, and fittings therefor, of plastics" },
      { heading: "3925", description: "Builders' ware of plastics (for example tanks and reservoirs)" },
    ],
    sections: {
      indianExport: [i("wi.ex.none", "Is there any product-specific Indian export requirement for pipes and irrigation products?", "Not confirmed.")],
      uaeImport: [
        i("wi.uae.water", "Does a product that carries drinking water need an approval from a water authority or certification body?", "Water-contact approval is often a hard gate. It has not been checked."),
        i("wi.uae.project", "Will buyers be contractors who need materials pre-approved by project authorities?", "Approved-material lists can decide who may supply."),
        i("wi.uae.agri", "For irrigation products, are there agriculture or landscaping authority requirements?", "Not yet checked."),
      ],
      testing: [
        i("wi.test.pressure", "Can you evidence pressure class and long-term strength to the standard the buyer specifies?", "Pressure products are normally sold against a stated standard."),
        i("wi.test.potable", "For potable use, do you hold material approvals for drinking-water contact?", "Often required for water-contact products."),
        i("wi.test.uv", "Can you evidence UV and chlorine resistance for outdoor and irrigation use?", "These drive real-world performance and buyer confidence."),
        i("wi.test.third", "Will buyers require third-party certification of your product range?", "Third-party certification adds time and cost."),
      ],
      packaging: [
        i("wi.pack.coil", "How will pipe be supplied (coils, lengths, bundles), and how does that affect freight volume?", "Packaging format changes freight cost materially."),
        i("wi.pack.mark", "What marking is expected on the pipe itself (size, pressure class, standard, batch)?", "Marking on the product is common for pressure products."),
      ],
      hs: [i("wi.hs.which", "Is it tubing or pipe (3917), builders' ware (3925), or another heading, and what is the 8-digit tariff line?", "Fittings and tanks may fall under different headings.", "inferred")],
      cepa: [],
      schemes: [],
    },
  },
  {
    id: "electrical-construction",
    name: "Conduits, ducts and construction profiles",
    covers: "Cable conduits, trunking, ducts, extruded profiles and trims.",
    entryIds: ["conduits-and-ducts", "extruded-profiles-and-trims"],
    hsCandidates: [
      { heading: "3917", description: "Tubes, pipes and hoses, and fittings therefor, of plastics" },
      { heading: "3916", description: "Monofilament, rods, sticks and profile shapes, of plastics" },
      { heading: "3925", description: "Builders' ware of plastics" },
    ],
    sections: {
      indianExport: [i("ec.ex.none", "Is there any product-specific Indian export requirement for electrical or construction plastics?", "Not confirmed.")],
      uaeImport: [
        i("ec.uae.elec", "Is conduit treated as an electrical product needing conformity assessment in the UAE?", "Electrical products often have a stricter regime. Not checked."),
        i("ec.uae.fire", "Are there fire-behaviour requirements for the building types you would supply?", "Fire performance can decide whether a product is usable at all."),
        i("ec.uae.utility", "Do emirate utilities or project authorities approve materials before use?", "Approved-supplier lists can decide who may sell."),
      ],
      testing: [
        i("ec.test.mech", "Can you evidence crush, impact and temperature performance to the standard the buyer specifies?", "Conduit is bought to a stated specification."),
        i("ec.test.fire", "Do you hold fire-behaviour test reports, and is a halogen-free or low-smoke grade expected?", "Material choice (for example PVC) affects fire and smoke properties."),
        i("ec.test.dim", "Can you show dimensional tolerances against the buyer's drawing for profiles?", "Custom profiles are accepted on tolerance and fit."),
      ],
      packaging: [
        i("ec.pack.length", "What lengths and bundling will you ship, and how does it affect container loading?", "Long products load differently and change freight cost."),
        i("ec.pack.mark", "What marking is expected on conduit (size, standard, batch, colour code)?", "Marking is common for electrical products."),
      ],
      hs: [i("ec.hs.which", "Is it a tube or pipe (3917), a profile shape (3916) or builders' ware (3925), and what is the 8-digit tariff line?", "The form and use decide it.", "inferred")],
      cepa: [],
      schemes: [],
    },
  },
];

export function familyForEntry(entryId: string | null | undefined): Family | null {
  if (!entryId) return null;
  return FAMILIES.find((f) => f.entryIds.includes(entryId)) ?? null;
}

export function familyById(id: string | null | undefined): Family | null {
  return FAMILIES.find((f) => f.id === id) ?? null;
}

/** The items for one section: common ones first, then the family's own. */
export function itemsFor(family: Family, section: SectionKey): Item[] {
  const common = (COMMON as Partial<Record<SectionKey, Item[]>>)[section] ?? [];
  return [...common, ...family.sections[section]];
}

export const ALL_SECTIONS: SectionKey[] = ["indianExport", "uaeImport", "testing", "packaging", "hs", "cepa", "schemes"];

/** Every item id for a family, in display order. Used for progress counts. */
export function allItemIds(family: Family): string[] {
  return ALL_SECTIONS.flatMap((s) => itemsFor(family, s).map((x) => x.id));
}

export const EVIDENCE_ORDER: Evidence[] = ["verified", "secondary", "user", "inferred", "assumption", "unknown"];

export const EVIDENCE_EXPLANATION: Record<Evidence, string> = {
  verified: "Read from an official primary source, with the source, passage and retrieval date shown. Nothing on this page is in this class yet.",
  secondary: "Reported by a trade guide, adviser or news source. The official text was not opened. Needs primary confirmation.",
  user: "Entered by the manufacturer. Not checked by us.",
  inferred: "Worked out by simple rules from your product type. A prompt to check, not a finding.",
  assumption: "A number or choice that you or the platform assumed, for example a sample duty rate.",
  unknown: "Not known to this platform. Needs an expert or the official source to answer.",
};

/**
 * A small, hand-trimmed copy of what the researched answers say about Indian export schemes, for the landing-page demo.
 * Nothing here calls AI or a network, and nothing states a rate, an amount or an approval. Source labels (document titles, shown as written) and URLs are copied
 * from src/lib/research/answers.ts. The full, per-product version lives in the app.
 */
export interface DemoSource { label: string; url: string }
export interface DemoScheme { name: string; why: string; confirm: string; source?: DemoSource }
export interface DemoFamily { id: string; name: string; schemes: DemoScheme[] }

const CEPA_SRC: DemoSource = { label: "Plexconcil circular on origin rules for Chapter 39", url: "https://plexconcil.org/public/custom/files/circulars/1784868141.pdf" };
const RODTEP_SRC: DemoSource = { label: "EY India: DGFT and RoDTEP rates and caps", url: "https://www.ey.com/en_in/technical/alerts-hub/2026/02/dgft-restricts-rodtep-benefits-to-50pc-of-notified-rates-and-value-caps-on-exported-products" };
const DRAWBACK_SRC: DemoSource = { label: "India Shipping News: CBIC circular on All Industry Rates", url: "https://indiashippingnews.com/cbic-issued-circular-regarding-the-revision-of-all-industry-rates-airs-of-duty-drawback/" };
const STATE_SRC: DemoSource = { label: "Corpseed: impact of the 2026 state industrial policy", url: "https://www.corpseed.com/law-update/impact-of-gujarat-industrial-policy-2026-on-industries-msmes-and-investors" };

const cepa = (why: string): DemoScheme => ({ name: "India-UAE trade agreement (CEPA) origin", why, confirm: "Read the product-specific origin rule for your 8-digit tariff line and check for amendments with the export promotion council or DGFT.", source: CEPA_SRC });
const rodtep = (why: string): DemoScheme => ({ name: "RoDTEP", why, confirm: "Check the current DGFT notification for your product's tariff line before quoting any rate.", source: RODTEP_SRC });
const drawback = (why: string): DemoScheme => ({ name: "Duty drawback", why, confirm: "Check the latest CBIC schedule, or ask your customs broker. Drawback and RoDTEP are generally not claimed for the same duty.", source: DRAWBACK_SRC });
const advance = (why: string): DemoScheme => ({ name: "Advance Authorisation", why, confirm: "Ask DGFT or a trade consultant about current norms for your product and the export obligation period." });
const state = (why: string): DemoScheme => ({ name: "State export incentives", why, confirm: "Check your state industries department or district industries centre for current eligibility.", source: STATE_SRC });

export const SCHEME_DEMO_FAMILIES: DemoFamily[] = [
  {
    id: "food-contact",
    name: "Food-contact plastic products",
    schemes: [
      cepa("Containers and tableware are plastics articles, so the trade agreement could give preferential treatment if the origin rule is met."),
      rodtep("Embedded taxes on exported goods may be refunded for some tariff lines, and your headings may be among them."),
      drawback("Worth a look if you import resin or additives that carry customs duty."),
      advance("Could suit a steady exporter that imports resin or masterbatch."),
      state("Your state may offer export support for manufacturers."),
    ],
  },
  {
    id: "household-general",
    name: "Household and general consumer plastics",
    schemes: [
      cepa("Household articles may qualify for preferential treatment, depending on the origin rule for the exact tariff line."),
      rodtep("Household and other plastic articles may sit under tariff lines that RoDTEP covers."),
      drawback("Relevant if part of your material is imported with duty paid."),
      advance("Could suit regular volumes where most of your inputs are imported."),
      state("Your state may offer support for exporting units and clusters."),
    ],
  },
  {
    id: "water-irrigation",
    name: "Pipes, fittings, irrigation and tanks",
    schemes: [
      cepa("Pipes and tanks are plastics articles. Preference depends on meeting the origin rule for the tariff line."),
      rodtep("Pipes and builders' ware may be under tariff lines that RoDTEP covers."),
      drawback("Worth a look if imported resin is a large part of your cost."),
      advance("Could suit regular exports of extruded products made from imported resin."),
      state("Your state may offer incentives for export-oriented manufacturing."),
    ],
  },
  {
    id: "electrical-construction",
    name: "Conduits, ducts and construction profiles",
    schemes: [
      cepa("Conduits and profiles are plastics articles. Preference depends on the origin rule for the exact heading."),
      rodtep("Conduits, profiles and builders' ware may fall under tariff lines that RoDTEP covers."),
      drawback("Relevant if you import compounds or resin that carry customs duty."),
      advance("Could suit a steady exporter of extruded products with imported inputs."),
      state("Your state may offer export support for manufacturers."),
    ],
  },
];

export const DEMO_DESTINATION = "United Arab Emirates";

/** Every English string the demo shows from this module, for the translation test. */
export function schemeDemoStrings(): string[] {
  return SCHEME_DEMO_FAMILIES.flatMap((f) => [f.name, ...f.schemes.flatMap((s) => [s.name, s.why, s.confirm])]);
}

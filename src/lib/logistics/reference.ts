/**
 * Reference rates behind the AI logistics estimate. Researched from public sources on 2026-10-22 for one trade lane (India west-coast ports to the destination hub port).
 *
 * READ THIS BEFORE RELYING ON IT
 *  - Ocean freight is volatile and these figures are a crisis-period snapshot, not a quote. Every range is low, typical and high.
 *  - Several figures are from older or secondary sources; each range says how good its basis is (`quality`). A few have no published
 *    figure at all and are model assumptions, labelled as such. Nothing here is a quote from a carrier, forwarder, broker or insurer.
 *  - The estimate fills the calculator lines as estimates, never as confirmed quotes.
 *  - A different lane is a different reference set with the same shape.
 */
export type Quality = "recent market quote" | "published tariff" | "older or secondary source" | "model assumption";

export interface RefSource {
  title: string;
  publisher: string;
  url: string;
}

export interface RefRange {
  low: number;
  typical: number;
  high: number;
  quality: Quality;
  note: string;
  sources: RefSource[];
}

export const LOGISTICS_AS_OF = "2026-10-22";
export const LANE = "India west-coast ports to the destination hub port";
export const USD_INR = 94.72;
export const USD_INR_AS_OF = "2026-10-22";
export const AED_PER_USD = 3.6725;

export const CONTAINERS: Record<"20GP" | "40GP" | "40HC", { cbm: number; payloadKg: number }> = {"20GP": {"cbm": 33, "payloadKg": 25000}, "40GP": {"cbm": 67, "payloadKg": 26500}, "40HC": {"cbm": 76, "payloadKg": 26000}};
export const CONTAINER_SOURCES: RefSource[] = [
 {
  "title": "20ft & 40ft Shipping Containers: Dimensions, Specs & Weight",
  "publisher": "Ship4wd",
  "url": "https://ship4wd.com/logistics-shipping/20ft-40ft-shipping-containers-specs"
 },
 {
  "title": "Container specification sheet",
  "publisher": "Leman Container",
  "url": "https://cdn.leman.com/wp-content/uploads/2024/04/container_spec_front_2015_us.pdf"
 },
 {
  "title": "Container size guide",
  "publisher": "Goodhope Freight",
  "url": "https://goodhopefreight.com/info/logistics-knowledge/container-size.html"
 }
];
/** Share of a container's volume that cartons can realistically fill. */
export const STUFFING_EFFICIENCY = 0.85;
export const LCL_MAX_CBM = 15;

const r = (low: number, typical: number, high: number, quality: Quality, note: string, sources: RefSource[]): RefRange => ({ low, typical, high, quality, note, sources });

export const REF = {
  /** USD per 20ft container. */
  ocean20: r(2100, 5242, 6607, "recent market quote", "Indicative spot range for the lane in Oct 2026; the low is a June 2026 trough. Surcharges (fuel, congestion, war-risk) may be additional.", [{"title": "Nhava Sheva to hub port FCL rates (updated 16 Oct 2026)", "publisher": "Cogoport", "url": "https://www.cogoport.com/rates/jnpt-nhava-sheva-sp-to-jebel-ali-sp"}, {"title": "India-regional container rates plunge as capacity returns (5 Jun 2026)", "publisher": "The Loadstar", "url": "https://theloadstar.com/india-gulf-container-rates-plunge-as-capacity-returns-and-cargo-backlogs-ease/"}]),
  /** USD per 40ft container (a 40ft high cube is priced the same on this lane). */
  ocean40: r(3200, 5563, 6607, "recent market quote", "One dated quote plus an indicative range (Oct 2026); the low is a June 2026 trough.", [{"title": "Container quote Navi Mumbai to hub port (1 Oct 2026)", "publisher": "Agora Freight", "url": "https://agorafreight.net/shipping-quotes/fcl-from-navi-mumbai-to-jebel-ali/"}, {"title": "India-regional container rates plunge as capacity returns (5 Jun 2026)", "publisher": "The Loadstar", "url": "https://theloadstar.com/india-gulf-container-rates-plunge-as-capacity-returns-and-cargo-backlogs-ease/"}, {"title": "High yields spark new container services on bumpy India-regional trade (8 Oct 2026)", "publisher": "The Loadstar", "url": "https://theloadstar.com/high-yields-spark-new-container-services-on-bumpy-india-middle-east-trade/"}]),
  /** USD per cubic metre for less-than-container loads. */
  lcl: r(55, 279, 284, "older or secondary source", "The typical figure is from an expired July 2026 offer; the low is a stale 2024 quote.", [{"title": "Nhava Sheva to hub port LCL rate", "publisher": "Flexport (via search result)", "url": "https://www.flexport.com/rates/innsa/aedxb"}, {"title": "Origin quote Mumbai to hub port LCL (Feb 2024)", "publisher": "Movers POE", "url": "https://data.moverspoe.com/AQS/AQS_OffersFiles/175229/RWQuote.htm"}]),
  /** Origin documentation, INR per shipment. */
  docs: r(5000, 6250, 8500, "older or secondary source", "A 2026 carrier bill-of-lading fee and an older forwarder figure.", [{"title": "Export local surcharge India (Jun 2026)", "publisher": "RCL", "url": "https://www-imedia.rclgroup.com/CorpWEB/PDF/Surcharge/LocalSurcharge-India-20260624-Export.pdf"}, {"title": "Q2 2025 General Tariff India", "publisher": "Forto", "url": "https://explore.forto.com/hubfs/General%20tariff/2025%20Q2/Q2%20General%20Tariff%20_%20India_valid%20until%202025-06-30.pdf"}]),
  /** Origin terminal handling, INR per container. */
  originThc: r(10700, 16500, 25060, "published tariff", "Carrier notices for the lane, 2026.", [{"title": "Price announcement India-Europe with Nhava Sheva OTHC (Jun-Jul 2026)", "publisher": "MSC", "url": "https://www.msc.com/fr/newsroom/customer-advisories/2026/july/pa-trade-from-india-and-pakistan-to-europe"}, {"title": "Export local surcharge India (Jun 2026)", "publisher": "RCL", "url": "https://www-imedia.rclgroup.com/CorpWEB/PDF/Surcharge/LocalSurcharge-India-20260624-Export.pdf"}]),
  /** Seals, user charges and box release at origin, INR per container (derived from carrier line items). */
  originOther: r(1070, 1500, 1820, "older or secondary source", "A derived sum of carrier line items.", [{"title": "Export local surcharge India (Jun 2026)", "publisher": "RCL", "url": "https://www-imedia.rclgroup.com/CorpWEB/PDF/Surcharge/LocalSurcharge-India-20260624-Export.pdf"}, {"title": "Export local charges India", "publisher": "MSC", "url": "https://www.msccargo.cn/-/media/files/msc-cargo/local-information/asia-pacific/india/export-local-charges-india--.pdf"}]),
  /** Customs house agent fee, INR per shipment. */
  customsAgent: r(2500, 3500, 6000, "model assumption", "No published fee was found. A planning assumption: replace it with your broker's quote.", []),
  /** Road haulage, INR per kilometre for the factory-to-port leg (one container). */
  haulage20: r(19, 24, 34, "model assumption", "Based on an undated trader listing of about INR 24 per km for a 20ft container. Distance and rate vary widely.", []),
  haulage40: r(23, 29, 41, "model assumption", "Based on an undated trader listing of about INR 29 per km for a 40ft container.", []),
  /** Marine cargo insurance, percent of insured value (invoice plus 10%). */
  insurance: r(0.1, 0.3, 0.6, "older or secondary source", "A general glossary range, not an insurer's tariff.", [{"title": "Marine insurance definition", "publisher": "Docshipper", "url": "https://docshipper.com/glossary/marine-insurance-definition-logistics/"}, {"title": "Marine cargo insurance for Indian exporters: ICC A, B, C", "publisher": "Credlix", "url": "https://blog.credlix.com/marine-cargo-insurance-for-indian-exporters-icc-a-b-and-c-clauses-explained-in-plain-language/"}]),
  /** Destination terminal handling, AED per container. */
  destThc: r(700, 1275, 1275, "older or secondary source", "A carrier sheet from Dec 2025 and an older terminal tariff.", [{"title": "Local surcharge import (Dec 2025 version)", "publisher": "RCL", "url": "https://www-imedia.rclgroup.com/CorpWEB/PDF/Surcharge/Local Surcharge_AE-20260618-Import.pdf"}, {"title": "MSC destination THC surcharge notice", "publisher": "AJOT", "url": "https://www.ajot.com/news/msc-jebel-ali-destination-terminal-handling-dthc-surcharge-scope-usa-puerto-rico-to-jebel-ali-united-arab-emirates"}]),
  /** Delivery order, AED per document set. */
  destDo: r(550, 575, 575, "published tariff", "Carrier sheets from late 2025.", [{"title": "Import/Export tariff", "publisher": "Milaha", "url": "https://www.milaha.com/sites/default/files/2025-11/Import%20Export%20Jebel%20Ali_ENG_V4.pdf"}, {"title": "Local surcharge import", "publisher": "RCL", "url": "https://www-imedia.rclgroup.com/CorpWEB/PDF/Surcharge/Local Surcharge_AE-20260618-Import.pdf"}, {"title": "Ocean freight import quote 2023", "publisher": "Scan Global Logistics", "url": "https://www.scangl.com/media/3bubyqfx/oceanfreight-import-dxb-2023.pdf"}]),
  /** Customs clearance agent and entry fees, AED per document set. */
  destClear: r(90, 175, 265, "older or secondary source", "Based on a 2023 forwarder quote and a government entry fee.", [{"title": "Country customs information", "publisher": "Aramex", "url": "https://www.aramex.com/ae/en/support/customs-clearance/country-search-results?country=AE"}, {"title": "Ocean freight import quote 2023", "publisher": "Scan Global Logistics", "url": "https://www.scangl.com/media/3bubyqfx/oceanfreight-import-dxb-2023.pdf"}]),
  /** Local delivery from the port, AED per container. */
  destLocal: r(400, 700, 700, "older or secondary source", "Based on a 2023 forwarder quote.", [{"title": "Ocean freight import quote 2023", "publisher": "Scan Global Logistics", "url": "https://www.scangl.com/media/3bubyqfx/oceanfreight-import-dxb-2023.pdf"}]),
};

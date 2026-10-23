import type { Tr } from "../landed-cost/labels.ts";

/**
 * The AI logistics estimate builds English sentences with numbers in them (estimate.ts). The estimate itself stays English, so tests and
 * the reference data are unchanged; the panel calls these to show the same sentence in the selected language. Pure, no React.
 */

/** "3 containers" / "a shared load", translated. */
function what(t: Tr, s: string): string {
  const m = s.match(/^(\d+) containers?$/);
  if (m) return m[1] === "1" ? t("{count} container", { count: m[1] }) : t("{count} containers", { count: m[1] });
  return t(s);
}

/** "2 × 20 ft and 1 × 40 ft" with the "and" in the selected language. */
function words(t: Tr, s: string): string {
  const parts = s.split(" and ");
  return parts.length === 2 ? t("{first} and {second}", { first: parts[0], second: parts[1] }) : s;
}

/** The shipment plan sentence. */
export function planSummary(t: Tr, s: string): string {
  let m = s.match(/^(\S+) m³ and (\S+) t is small enough to ship as a shared \(LCL\) load, which is cheaper here than a full container\.$/);
  if (m) return t("{volume} m³ and {tonnes} t is small enough to ship as a shared (LCL) load, which is cheaper here than a full container.", { volume: m[1], tonnes: m[2] });
  m = s.match(/^(\S+) m³ and (\S+) t: (.+) containers? \(cartons fill about (\d+)% of the volume; weight is within the limit\)\.$/);
  if (m) {
    const list = words(t, m[3]);
    const plural = /containers \(/.test(s);
    const w = plural ? t("{list} containers", { list }) : t("{list} container", { list });
    return t("{volume} m³ and {tonnes} t: {boxes} (cartons fill about {pct}% of the volume; weight is within the limit).", { volume: m[1], tonnes: m[2], boxes: w, pct: m[4] });
  }
  return t(s);
}

/** The "how this figure was estimated" sentence for one charge. */
export function howEstimated(t: Tr, s: string): string {
  let m = s.match(/^Road haulage for (.+) over (\d+(?:\.\d+)?) km, at a typical per-kilometre truck rate\. No published tariff was found, so this is the weakest figure here\.$/);
  if (m) return t("Road haulage for {what} over {km} km, at a typical per-kilometre truck rate. No published tariff was found, so this is the weakest figure here.", { what: what(t, m[1]), km: m[2] });
  m = s.match(/^Customs house agent fee, bill-of-lading documentation, and origin terminal handling, seals and user charges for (.+)\.$/);
  if (m) return t("Customs house agent fee, bill-of-lading documentation, and origin terminal handling, seals and user charges for {what}.", { what: what(t, m[1]) });
  m = s.match(/^Current spot ocean rates for (.+) at USD (\S+) to the rupee \((.+)\)\. Rates move quickly and extra surcharges can apply\.$/);
  if (m) return t("Current spot ocean rates for {what} at USD {rate} to the rupee ({date}). Rates move quickly and extra surcharges can apply.", { what: what(t, m[1]), rate: m[2], date: m[3] });
  m = s.match(/^A shared-load rate on (\S+) billable m³ at USD (\S+) to the rupee \((.+)\)\. Rates move quickly and extra surcharges can apply\.$/);
  if (m) return t("A shared-load rate on {volume} billable m³ at USD {rate} to the rupee ({date}). Rates move quickly and extra surcharges can apply.", { volume: m[1], rate: m[2], date: m[3] });
  m = s.match(/^Terminal handling for (.+), the delivery order, and the customs clearance agent's fee\. Based on carrier sheets and an older forwarder quote\.$/);
  if (m) return t("Terminal handling for {what}, the delivery order, and the customs clearance agent's fee. Based on carrier sheets and an older forwarder quote.", { what: what(t, m[1]) });
  m = s.match(/^Local delivery from the port for (.+)\. Based on an older forwarder quote\.$/);
  if (m) return t("Local delivery from the port for {what}. Based on an older forwarder quote.", { what: what(t, m[1]) });
  return t(s);
}

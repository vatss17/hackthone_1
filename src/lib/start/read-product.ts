/** Reads a short free-text product description by plain rules. Nothing is sent anywhere. Anything not found stays empty. */
export type ReadStatus = "found" | "guess" | "missing";
export type ReadRow = { key: "name" | "material" | "use" | "weightKg" | "size"; label: string; value: string; status: ReadStatus };

const STORAGE = /storage|crate|box|bin|basket|tub/i;

export function readProduct(name: string, description: string): ReadRow[] {
  const text = `${name} ${description}`;
  const weight = description.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  const grams = description.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  const size = description.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i);
  const material = /hdpe/i.test(text) ? "HDPE" : /ldpe/i.test(text) ? "LDPE" : /\bpp\b|polypropylene/i.test(text) ? "PP" : /\bpet\b/i.test(text) ? "PET" : "";
  const use = STORAGE.test(text) ? "Storage" : /pipe|conduit|tube/i.test(text) ? "Pipes and conduit" : /bottle|drum|container/i.test(text) ? "Holding liquids or goods" : "";
  const row = (key: ReadRow["key"], label: string, value: string, status: ReadStatus): ReadRow => ({ key, label, value, status: value ? status : "missing" });
  return [
    row("name", "Product", name.trim(), "found"),
    row("material", "Material", material, "found"),
    row("use", "Intended use", use, "guess"),
    row("weightKg", "Weight (kg)", weight ? weight[1] : grams ? String(Number(grams[1]) / 1000) : "", "found"),
    row("size", "Size (mm)", size ? `${size[1]} x ${size[2]} x ${size[3]}` : "", "found"),
  ];
}

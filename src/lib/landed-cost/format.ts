const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export const formatInr = (n: number) => (Number.isFinite(n) ? `INR ${inr.format(n)}` : "not reachable");
export const formatAed = (n: number) => (Number.isFinite(n) ? `AED ${inr.format(n)}` : "not reachable");
export const formatNumber = (n: number) => num.format(n);
export const formatPct = (n: number | null) => (n === null ? "n/a" : `${num.format(n)}%`);
/** A signed difference, with an explicit plus sign. */
export const formatSigned = (n: number, suffix = "") => `${n > 0 ? "+" : n < 0 ? "-" : ""}${num.format(Math.abs(n))}${suffix}`;

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { LineResult } from "@/lib/landed-cost/types";
import type { Sensitivity } from "@/lib/landed-cost/calc";
import { formatAed, formatInr, formatPct, formatSigned } from "@/lib/landed-cost/format";

/** Plain HTML/CSS charts. Every bar also has its number in text, so colour is never the only signal. */

export const GROUP_COLOR: Record<LineResult["group"], string> = {
  Production: "var(--primary)",
  Packaging: "#6f9a96",
  "Origin logistics": "#9bb8b4",
  International: "#55676c",
  Destination: "#a9b6b9",
  Duty: "var(--amber)",
  Other: "#d3dbd7",
};

export function groupTotals(lines: LineResult[]) {
  const totals = new Map<LineResult["group"], number>();
  for (const l of lines) totals.set(l.group, (totals.get(l.group) ?? 0) + l.totalInr);
  return [...totals.entries()].filter(([, v]) => v > 0);
}

/** One stacked bar for the whole cost, with a legend that carries the amounts and shares. */
export function CostBreakdown({ lines, totalInr, inrPerAed }: { lines: LineResult[]; totalInr: number; inrPerAed: number }) {
  const t = useT();
  const groups = groupTotals(lines);
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-sm border bg-muted" role="img" aria-label={t("Cost breakdown by group")}>
        {groups.map(([g, v]) => (
          <div key={g} style={{ width: `${(v / totalInr) * 100}%`, background: GROUP_COLOR[g] }} title={`${t(g)}: ${formatInr(v)}`} />
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">{t("Cost by group for the whole consignment")}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1 pr-2 font-medium">{t("Group")}</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">INR</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">AED</th>
            <th scope="col" className="py-1 text-right font-medium">{t("Share")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map(([g, v]) => (
            <tr key={g}>
              <td className="py-1.5 pr-2">
                <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: GROUP_COLOR[g] }} aria-hidden />
                {t(g)}
              </td>
              <td className="py-1.5 pr-2 text-right tnum">{formatInr(v).replace("INR ", "")}</td>
              <td className="py-1.5 pr-2 text-right tnum">{formatAed(v / inrPerAed).replace("AED ", "")}</td>
              <td className="py-1.5 text-right tnum">{formatPct(Math.round((v / totalInr) * 1000) / 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sensitivity bars: how many percentage points of margin each variable moves, down and up by the same relative amount. */
export function Tornado({ rows }: { rows: Sensitivity[] }) {
  const t = useT();
  const labels = [...new Set(rows.map((r) => r.label))];
  const entries = labels
    .map((label) => {
      const down = rows.find((r) => r.label === label && r.changeLabel.startsWith("-"));
      const up = rows.find((r) => r.label === label && r.changeLabel.startsWith("+"));
      return { label, down: down?.deltaPp ?? 0, up: up?.deltaPp ?? 0, downLabel: down?.changeLabel ?? "", upLabel: up?.changeLabel ?? "" };
    })
    .sort((a, b) => Math.max(Math.abs(b.down), Math.abs(b.up)) - Math.max(Math.abs(a.down), Math.abs(a.up)));
  const max = Math.max(1, ...entries.flatMap((e) => [Math.abs(e.down), Math.abs(e.up)]));
  return (
    <div role="group" aria-label={t("Margin sensitivity")}>
      <ul className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.label} className="grid grid-cols-[1fr] gap-1 sm:grid-cols-[11rem_1fr_13rem] sm:items-center sm:gap-3">
            <span className="text-sm">{t(e.label)}</span>
            <div className="relative h-4" aria-hidden>
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              {[e.down, e.up].map((d, idx) => (
                <div
                  key={idx}
                  className={cn("absolute top-0 h-2 rounded-sm", idx === 0 ? "top-0" : "top-2")}
                  style={{
                    background: d < 0 ? "var(--amber)" : "var(--primary)",
                    width: `${(Math.abs(d) / max) * 50}%`,
                    left: d < 0 ? `${50 - (Math.abs(d) / max) * 50}%` : "50%",
                  }}
                />
              ))}
            </div>
            <span className="tnum text-xs text-muted-foreground sm:whitespace-nowrap">
              {e.downLabel} {formatSigned(e.down, " " + t("pp"))} · {e.upLabel} {formatSigned(e.up, " " + t("pp"))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t("Each variable is moved down and up by the same relative amount, one at a time. Amber is a loss of margin, teal a gain. pp = percentage points of gross margin.")}</p>
    </div>
  );
}

/** Margin per scenario against the target margin. */
export function MarginBars({ items, target }: { items: { name: string; margin: number | null; hypothetical?: boolean }[]; target: number }) {
  const t = useT();
  const scale = Math.max(target * 1.5, ...items.map((i) => Math.abs(i.margin ?? 0)), 10);
  return (
    <ul className="space-y-2.5" aria-label={t("Gross margin by scenario")}>
      {items.map((i) => {
        const m = i.margin ?? 0;
        return (
          <li key={i.name} className="grid gap-1 sm:grid-cols-[14rem_1fr_4.5rem] sm:items-center sm:gap-3">
            <span className="text-sm">
              {i.name}
              {i.hypothetical && !/hypothetical/i.test(i.name) && <span className="ml-1 text-xs text-muted-foreground">({t("hypothetical")})</span>}
            </span>
            <div className="relative h-3 rounded-sm bg-muted" aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.max(0, Math.min(100, (Math.max(m, 0) / scale) * 100))}%`, background: m < 0 ? "var(--destructive)" : m < target ? "var(--amber)" : "var(--primary)" }} />
              <div className="absolute inset-y-[-3px] w-0.5 bg-foreground/60" style={{ left: `${(target / scale) * 100}%` }} title={t("Target {pct}%", { pct: target })} />
            </div>
            <span className="tnum text-sm">{formatPct(i.margin)}</span>
          </li>
        );
      })}
      <li className="text-xs text-muted-foreground">{t("The dark tick marks your {pct}% target margin.", { pct: target })}</li>
    </ul>
  );
}

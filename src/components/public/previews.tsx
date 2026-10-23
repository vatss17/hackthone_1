"use client";

import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useT } from "@/lib/i18n/client";

/**
 * Accurate renderings of real screens, drawn with the same components and tokens as the app, using fixed SAMPLE data.
 * They are vector (crisp at any zoom) and labelled as samples. No figure here is a measurement or a market statistic.
 */

function Frame({ title, tag, children, className = "" }: { title: string; tag?: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <figure className={`min-w-0 overflow-hidden rounded-lg border bg-card text-left ${className}`}>
      <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="min-w-0 truncate text-[13px] font-medium">{title}</span>
        <span className="shrink-0 rounded border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 text-xs font-medium text-(--status-estimate-fg)">{tag ?? t("Sample data")}</span>
      </figcaption>
      {children}
    </figure>
  );
}

const money = (n: number) => `AED ${n.toFixed(2)}`;

export function WorkspacePreview() {
  const t = useT();
  const rows: { task: string; issue: string; status: "review" | "progress" | "notstarted"; statusLabel: string; action: string }[] = [
    { task: t("Replace the sample inputs with your own costs"), issue: t("13 of 13 assumptions are still samples"), status: "review", statusLabel: t("Needs review"), action: t("Edit costs") },
    { task: t("Confirm the HS code"), issue: t("Customs heading not yet confirmed"), status: "progress", statusLabel: t("In progress"), action: t("Open") },
    { task: t("Answer the screening questions"), issue: t("0 of 27 answered"), status: "notstarted", statusLabel: t("Not started"), action: t("Start") },
    { task: t("Complete the invoice draft"), issue: t("9 fields missing"), status: "notstarted", statusLabel: t("Not started"), action: t("Open") },
  ];
  const icon = { review: CircleAlert, progress: CircleDot, notstarted: CircleDot } as const;
  return (
    <Frame title={t("Stackable storage crate 40 L · Work queue")}>
      <div className="border-b bg-selected px-4 py-3">
        <p className="text-[13px] text-muted-foreground">{t("Next action")}</p>
        <p className="mt-0.5 text-[15px] font-semibold">{t("Replace the sample inputs with your own costs and price")}</p>
      </div>
      <ul className="divide-y sm:hidden">
        {rows.map((r) => {
          const Icon = icon[r.status];
          return (
            <li key={r.task} className="px-4 py-3">
              <p className="text-[15px] font-medium">{r.task}</p>
              <p className="text-[13px] text-muted-foreground">{r.issue}</p>
              <p className="mt-1.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="inline-flex items-center gap-1"><Icon aria-hidden className="size-3.5 text-muted-foreground" />{r.statusLabel}</span>
                <span className="font-medium text-primary">{r.action}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <table className="hidden w-full text-sm sm:table">
        <caption className="sr-only">{t("Sample work queue: task, unresolved issue, status and action")}</caption>
        <thead>
          <tr className="border-b text-left text-[13px] text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium">{t("Task")}</th>
            <th scope="col" className="px-2 py-2 font-medium">{t("Unresolved")}</th>
            <th scope="col" className="px-2 py-2 font-medium">{t("Status")}</th>
            <th scope="col" className="px-4 py-2"><span className="sr-only">{t("Action")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const Icon = icon[r.status];
            return (
              <tr key={r.task}>
                <td className="px-4 py-2.5 font-medium">{r.task}</td>
                <td className="px-2 py-2.5 text-muted-foreground">{r.issue}</td>
                <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px]"><Icon aria-hidden className="size-3.5 text-muted-foreground" />{r.statusLabel}</span></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-[13px] font-medium text-primary">{r.action}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <dl className="grid grid-cols-3 divide-x border-t text-sm">
        {[[t("Landed cost per unit"), money(4.46)], [t("Selling price"), money(6.0)], [t("Gross margin"), "25.7%"]].map(([k, v]) => (
          <div key={k} className="px-4 py-2.5">
            <dt className="text-[13px] text-muted-foreground">{k}</dt>
            <dd className="tnum font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  );
}

export function FitPreview() {
  const t = useT();
  const rows = [
    { name: t("Hangers and laundry products"), fit: t("Strong capability fit"), gap: t("Tooling to confirm: high-cavity hanger moulds") },
    { name: t("Plastic pallets and large industrial bins"), fit: t("Strong capability fit"), gap: t("Large-tonnage press not declared") },
    { name: t("Caps, closures and lids"), fit: t("Good capability fit"), gap: t("Cap tooling and torque testing to plan") },
  ];
  return (
    <Frame title={t("Opportunities for your factory")}>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.name} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[15px] font-medium">{r.name}</p>
              <p className="text-[13px] font-medium">{r.fit}</p>
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{r.gap}</p>
            <div className="mt-2 flex flex-wrap gap-2"><StatusBadge kind="inferred" /><StatusBadge kind="nodata" /></div>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">{t("Fit is worked out from the processes, materials and machines you declare. It is not market demand.")}</p>
    </Frame>
  );
}

export function CostPreview() {
  const t = useT();
  const lines: [string, number][] = [[t("Product at factory gate"), 3.17], [t("Freight and handling"), 0.62], [t("Insurance"), 0.02], [t("Import duty (assumption)"), 0.4], [t("Port and clearance"), 0.25]];
  const landed = lines.reduce((t, [, v]) => t + v, 0);
  return (
    <Frame title={t("Landed cost per unit")}>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-card px-4 py-3">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("Sample landed cost lines in AED per unit")}</caption>
            <tbody>
              {lines.map(([k, v]) => (
                <tr key={k} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted-foreground">{k}</th>
                  <td className="tnum py-1.5 text-right">{v.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t">
                <th scope="row" className="pt-2 text-left font-semibold">{t("Landed cost")}</th>
                <td className="tnum pt-2 text-right font-semibold">{landed.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-card px-4 py-3 text-sm">
          <p className="text-[13px] text-muted-foreground">{t("If you can only sell at AED 3.50")}</p>
          <p className="tnum mt-1 flex items-center gap-1.5 text-xl font-semibold text-error"><CircleAlert aria-hidden className="size-5" />{t("-{pct}% margin", { pct: Math.abs(((3.5 - landed) / 3.5) * 100).toFixed(1) })}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("Loss-making at these inputs. Break-even is {amount}.", { amount: money(landed) })}</p>
          <div className="mt-3 flex flex-wrap gap-2"><StatusBadge kind="assumption" /><StatusBadge kind="estimate" /></div>
        </div>
      </div>
    </Frame>
  );
}

export function DocumentPreview() {
  const t = useT();
  return (
    <Frame title={t("Commercial invoice · draft")} tag={t("Draft, sample data")}>
      <div className="bg-muted p-3 sm:p-4">
        <div className="mx-auto max-w-md rounded border bg-white p-4 text-[12px] leading-[1.45] text-black">
          <p className="border border-dashed border-black px-2 py-1 text-center font-medium">DRAFT: review required. Not a final document.</p>
          <p className="mt-3 text-sm font-semibold tracking-wide">COMMERCIAL INVOICE</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div><p className="text-[11px] text-neutral-600">Exporter</p><p className="font-medium">Sample Polymers Private Limited</p><p>Vapi, Gujarat, India</p></div>
            <div><p className="text-[11px] text-neutral-600">Buyer</p><p className="rounded bg-(--status-estimate-bg) px-1 italic">[missing: buyer name and address]</p></div>
          </div>
          <table className="mt-3 w-full border-collapse text-[12px]">
            <thead><tr className="border-y border-black text-left"><th scope="col" className="py-1 font-medium">Description</th><th scope="col" className="py-1 text-right font-medium">Qty</th><th scope="col" className="py-1 text-right font-medium">Amount (AED)</th></tr></thead>
            <tbody><tr className="border-b border-neutral-400"><td className="py-1">Stackable storage crate 40 L</td><td className="tnum py-1 text-right">20,000</td><td className="tnum py-1 text-right">120,000.00</td></tr></tbody>
          </table>
          <p className="mt-2 flex items-center gap-1 text-[11px]"><CircleCheck aria-hidden className="size-3" />Rows and totals agree.</p>
        </div>
      </div>
    </Frame>
  );
}

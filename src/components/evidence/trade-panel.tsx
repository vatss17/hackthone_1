import { StatusBadge } from "@/components/status-badge";
import { SOURCE, type EntryEvidence, type HeadingEvidence, type YearPoint } from "@/lib/trade/evidence";
import { fmtTonnes, fmtUsd } from "@/lib/trade/format";
import { getT } from "@/lib/i18n/server";
import { tr, trTonnes, trUsd } from "@/lib/opportunities/localize";

/** A tiny bar series. The number is always in text beside the bar, so colour is never the only signal. */
async function Series({ points, label }: { points: YearPoint[]; label: string }) {
  const { t } = await getT();
  if (points.length === 0) return <p className="text-xs text-muted-foreground">{t("No data returned for this series.")}</p>;
  const max = Math.max(...points.map((p) => p.valueUsd));
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium text-muted-foreground">{label}</figcaption>
      <ul className="space-y-1" aria-label={label}>
        {points.map((p) => (
          <li key={p.year} className="grid grid-cols-[2.5rem_1fr_6.5rem] items-center gap-2 text-xs">
            <span className="tnum text-muted-foreground">{p.year}</span>
            <span className="h-2 rounded-sm bg-muted" aria-hidden>
              <span className="block h-full rounded-sm bg-primary" style={{ width: `${Math.max(2, (p.valueUsd / max) * 100)}%` }} />
            </span>
            <span className="text-right tnum">{fmtUsd(p.valueUsd).replace("USD ", "").replace(" million", ` ${t("million")}`).replace(" billion", ` ${t("billion")}`)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export async function HeadingBlock({ h }: { h: HeadingEvidence }) {
  const { t } = await getT();
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            <span className="mr-2 tnum text-primary">HS {h.heading}</span>
            {t(h.label)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("Broad heading: many products sit inside it.")}</p>
        </div>
        <StatusBadge kind="reported" />
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t("Destination imports from all countries")}{h.latestUae ? `, ${h.latestUae.year}` : ""}</dt>
          <dd className="tnum text-lg font-semibold">{h.latestUae ? trUsd(t, fmtUsd(h.latestUae.valueUsd)) : t("not reported")}</dd>
          {h.latestUae?.netWeightKg ? <dd className="tnum text-xs text-muted-foreground">{t("{weight} net weight", { weight: trTonnes(t, fmtTonnes(h.latestUae.netWeightKg)) })}</dd> : <dd className="text-xs text-muted-foreground">{t("net weight not reported")}</dd>}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("India-reported exports to the destination")}{h.latestIndia ? `, ${h.latestIndia.year}` : ""}</dt>
          <dd className="tnum text-lg font-semibold">{h.latestIndia ? trUsd(t, fmtUsd(h.latestIndia.valueUsd)) : t("not reported")}</dd>
          <dd className="text-xs text-muted-foreground">{t("India's own report (mirror data)")}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Series points={h.uaeImports} label={t("destination-reported imports from all countries (USD, CIF)")} />
        <Series points={h.indiaExports} label={t("India-reported exports to the destination (USD, FOB)")} />
      </div>
      {h.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {h.notes.map((n) => (
            <li key={n}>{tr(t, n)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Reported destination trade data for the headings a product may fall under, with source, freshness and limits. */
export async function TradeEvidencePanel({ evidence }: { evidence: EntryEvidence }) {
  const { t } = await getT();
  if (!evidence.hasData) {
    return (
      <div className="rounded-md border border-dashed border-input/60 bg-card px-4 py-5 text-sm text-muted-foreground">
        <p>{evidence.loaded ? t("No reported trade data is available for this product type, so there is no market evidence either way.") : t(evidence.emptyReason)}</p>
        <p className="mt-2 text-xs">
          <span className="font-medium text-foreground">{t("Source it would come from:")}</span> {t(SOURCE.name)}, {t(SOURCE.publisher)}. {t("Nothing is estimated or filled in when the data is absent.")}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted px-4 py-3 text-sm">
        <p className="font-medium">{t("Market evidence, not demand.")}</p>
        <p className="mt-0.5 text-muted-foreground">
          {t("Reported trade values for broad HS headings. They show that trade exists, not that anyone would buy your product, at what price, or from you.")} {t(evidence.mappingNote)}
        </p>
      </div>
      <div className="grid gap-4">
        {evidence.headings.map((h) => (
          <HeadingBlock key={h.heading} h={h} />
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t("Source:")}</span> {t(SOURCE.name)}, {t(SOURCE.publisher)}. <span className="font-medium text-foreground">{t("Freshness:")}</span> {tr(t, evidence.freshness)}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer font-medium text-foreground">{t("Limitations and licence")}</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {evidence.limitations.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
            <li>{t(SOURCE.licence)}</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { StatusBadge } from "@/components/status-badge";
import { explainWithAi } from "@/lib/actions/ai";
import type { AiStatus } from "@/lib/ai/provider";
import type { Explanation } from "@/lib/ai/schemas";
import type { Commercial } from "@/lib/explain/product";
import { useT } from "@/lib/i18n/client";

type Done = { explanation: Explanation; dropped: number; provider: string; model: string; at: string };

/**
 * Optional AI-written explanation, grounded only in the facts the platform already shows. It is
 * labelled as AI, validated on the server, and never replaces the deterministic explanation above it.
 * When AI is not configured it says exactly what is needed, and does nothing else.
 */
export function AiExplainer({ productRef, status, commercial }: { productRef: string; status: AiStatus; commercial: Commercial | null }) {
  const t = useT();
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!status.configured) {
    return (
      <div className="rounded-md border border-dashed border-input/60 bg-card p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{t("AI explanation")}</h3>
          <StatusBadge kind="off" />
        </div>
        <p className="mt-1 text-muted-foreground">{t("Not switched on. Everything above is produced by rules from your data and the trade snapshot, and is labelled that way. AI is never used unless it is switched on and you agree each time.")}</p>
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{t("What the operator needs to set")}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {status.missing.map((m) => (
              <li key={m} className="font-mono">
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-1">{t("These are server settings. Keys are never entered in the app or shown in it.")}</p>
        </details>
      </div>
    );
  }

  const run = () =>
    start(async () => {
      setError(null);
      const r = await explainWithAi(productRef, consent, commercial);
      if (r.ok) setResult(r);
      else setError(r.error);
    });

  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("AI explanation (optional)")}</h3>
        <StatusBadge kind="ai" />
      </div>
      <p className="mt-1 text-muted-foreground">
        {t("Writes a short explanation from only the facts shown on this page. It cannot add quotations, regulations, tariffs, certifications or statistics, and statements that try are removed.")}
      </p>
      <label className="mt-3 flex items-start gap-2">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {t("I agree that this product and capability information (no company name, address or identifiers) is sent to {provider} ({model}) to write this explanation.", { provider: status.provider ?? "", model: status.model ?? "" })}
        </span>
      </label>
      <div className="mt-3">
        <Button type="button" disabled={!consent || pending} onClick={run}>
          {pending ? t("Writing…") : result ? t("Write it again") : t("Explain with AI")}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{t(error)}</Notice>
        </div>
      )}
      {result && (
        <div className="mt-4 rounded-md border bg-muted/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="ai" />
            <span className="text-xs text-muted-foreground">
              {result.provider} · {result.model} · {result.at.slice(0, 16).replace("T", " ")} UTC · {t("confidence: {level}", { level: t(result.explanation.confidence) })}
            </span>
          </div>
          {result.explanation.headline && <p className="mt-2 text-base font-semibold leading-snug">{result.explanation.headline}</p>}
          {(
            [
              [t("Why it may fit"), result.explanation.whyItFits],
              [t("Tooling and equipment to confirm"), result.explanation.toolingToConfirm],
              [t("What remains uncertain"), result.explanation.uncertainties],
              [t("Customer industries to consider"), result.explanation.industries],
            ] as [string, string[]][]
          )
            .filter(([, items]) => items.length)
            .map(([title, items]) => (
              <div key={title} className="mt-3">
                <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Written by AI from the facts above. Not verified, not regulatory advice, and not saved anywhere.")}
            {result.dropped > 0 ? ` ${result.dropped === 1 ? t("{count} statement removed because it failed validation.", { count: result.dropped }) : t("{count} statements removed because they failed validation.", { count: result.dropped })}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

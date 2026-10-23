"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { RESEARCH_AS_OF, type ResearchAnswer } from "@/lib/research/answers";
import { useT } from "@/lib/i18n/client";

/**
 * An AI-researched draft answer to one screening question: the answer, the points it rests on, what is still to confirm, and the sources.
 * It is always a draft. The person decides whether to use it, and using it records it as "AI research draft", never as a verified fact.
 */
export function AiAnswerPanel({ r, used, onUse, onHide }: { r: ResearchAnswer; used: boolean; onUse: () => void; onHide: () => void }) {
  const t = useT();
  const confidence = { high: t("High confidence"), medium: t("Medium confidence"), low: t("Low confidence: treat as a lead") } as const;
  return (
    <div className="mt-3 rounded-lg border border-(--status-ai-border) bg-selected p-4 text-sm" role="region" aria-label={t("AI research draft")}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="ai" />
        <span className="font-medium">{t("AI research draft")}</span>
        <span className="text-muted-foreground">· {confidence[r.confidence]}</span>
        <span className="text-muted-foreground">· {t("Researched in English")}</span>
      </div>
      <p lang="en" className="mt-2 leading-relaxed">{r.answer}</p>
      {r.keyPoints.length > 0 && (
        <ul lang="en" className="mt-2 list-disc space-y-0.5 pl-5">
          {r.keyPoints.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
      <p className="mt-3">
        <span className="font-medium">{t("Still to confirm:")} </span>
        <span lang="en">{r.whatToConfirm}</span>
      </p>
      <div className="mt-3">
        <p className="text-[13px] font-medium">{t("Sources, researched {date}", { date: RESEARCH_AS_OF })}</p>
        {r.sources.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("No usable source was found. Treat this as a lead to check, not an answer.")}</p>
        ) : (
          <ul className="mt-1 space-y-1 text-[13px]">
            {r.sources.map((s) => (
              <li key={s.url} lang="en">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                  {s.title}
                  <ExternalLink aria-hidden className="size-3" />
                </a>
                {s.publisher && <span className="text-muted-foreground"> · {s.publisher}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">{t("A draft drawn from public sources. It is not advice or an approval, and some sources are secondary. Confirm it before you rely on it.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onUse} disabled={used}>
          {used ? t("Recorded as your answer") : t("Use as my answer")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onHide}>
          {t("Hide")}
        </Button>
      </div>
    </div>
  );
}

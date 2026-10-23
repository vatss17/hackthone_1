"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiveProduct } from "@/lib/actions/capabilities";
import { useT } from "@/lib/i18n/client";

const UNDO_SECONDS = 10;

/**
 * Archiving, with the consequences stated first and an immediate Undo. Nothing is archived until the countdown ends: Undo, leaving this page
 * or closing it simply means nothing happened. After the countdown the product is archived (never deleted) and listed under Archived products.
 */
export function ArchiveProduct({ productId, productName }: { productId: string; productName: string }) {
  const t = useT();
  const [stage, setStage] = useState<"idle" | "confirm" | "counting">("idle");
  const [left, setLeft] = useState(UNDO_SECONDS);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (stage !== "counting") return;
    if (left <= 0) {
      const fd = new FormData(formRef.current ?? undefined);
      start(() => archiveProduct(fd));
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, left]);

  return (
    <div>
      <form ref={formRef}>
        <input type="hidden" name="productId" value={productId} />
      </form>
      {stage === "idle" && (
        <Button type="button" variant="destructive" className="h-11 md:h-10" onClick={() => setStage("confirm")}>
          {t("Archive product")}
        </Button>
      )}
      {stage === "confirm" && (
        <div className="rounded-md border bg-muted/40 p-4 text-sm" role="group" aria-label={t("Archive {name}", { name: productName })}>
          <p className="font-medium">{t("What happens if you archive {name}", { name: productName })}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>{t("It leaves your active catalogue, your opportunities and your export workspace.")}</li>
            <li>{t("Nothing is deleted. Its specifications, factory links and materials are kept, and so are the assessments, roadmap progress, documents and expert briefs saved in this browser.")}</li>
            <li>{t("It stays visible under Archived products on the Products page.")}</li>
            <li>{t("An archived product cannot be edited. Restoring it needs a database function that has been prepared but is not switched on yet.")}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={() => { setLeft(UNDO_SECONDS); setStage("counting"); }}>
              {t("Archive it (you will have {seconds} seconds to undo)", { seconds: UNDO_SECONDS })}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStage("idle")}>
              {t("Keep it")}
            </Button>
          </div>
        </div>
      )}
      {stage === "counting" && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-4 text-sm" role="status" aria-live="polite">
          <span>{pending ? t("Archiving…") : left === 1 ? t("Archiving {name} in {left} second.", { name: productName, left }) : t("Archiving {name} in {left} seconds.", { name: productName, left })}</span>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setStage("idle")}>
            {t("Undo")}
          </Button>
        </div>
      )}
    </div>
  );
}

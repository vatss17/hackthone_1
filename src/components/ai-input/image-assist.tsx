"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CircleAlert, FileUp, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistDialog, useFailureText } from "@/components/ai-input/shared";
import { useI18n } from "@/lib/i18n/client";
import { prepareImage } from "@/lib/ai-input/browser";
import type { VisionField, VisionKind, VisionResult } from "@/lib/ai-input/vision";
import { cn } from "@/lib/utils";

/** Translates a field label, keeping a trailing series number ("Dimension 2"). */
const labelText = (t: (s: string) => string, label: string) => {
  const m = /^(.*?) (\d{1,2})$/.exec(label);
  return m ? `${t(m[1])} ${m[2]}` : t(label);
};

export interface AppliedField {
  key: string;
  value: string;
  unit: string | null;
}

type Phase = { name: "choose" } | { name: "ready" } | { name: "working" } | { name: "error"; code: string } | { name: "review"; result: VisionResult };

/**
 * "Read from a photo": pick or take a picture, agree to send it, review every field the AI read, and apply only what you tick.
 * The picture is sent for this one request and is not stored. Nothing is saved here: `onApply` fills the same form the person
 * could have typed into, and the form's own Save does the rest.
 */
export function ImageAssist({
  kind,
  onApply,
  label,
  className,
}: {
  kind: VisionKind;
  /** Return how many values actually landed in the form, so the message is accurate. */
  onApply: (fields: AppliedField[]) => number | void;
  label?: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const failure = useFailureText();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "choose" });
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const TITLES: Record<VisionKind, string> = {
    nameplate: t("Read a machine nameplate"),
    machine_photo: t("Recognise a machine from a photo"),
    material_label: t("Read a raw-material label"),
    product_photo: t("Describe a product from a photo"),
    drawing: t("Read a drawing or specification sheet"),
  };
  const HINTS: Record<VisionKind, string> = {
    nameplate: t("Photograph the metal plate on the machine, straight on and in good light, so every line is sharp."),
    machine_photo: t("Photograph the whole machine. Atlas can suggest what kind of machine it is, but it cannot tell its capacity or output from a picture."),
    material_label: t("Photograph the bag or label so the polymer name and grade are readable."),
    product_photo: t("Photograph the finished product on a plain background. Atlas describes what it sees; you confirm the material, size and weight."),
    drawing: t("Upload a clear photo or PDF of the drawing or specification sheet."),
  };

  // The preview address is derived from the file, and released when the file changes or the dialog goes away.
  const preview = useMemo(() => (file && file.type !== "application/pdf" ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (done === null) return;
    const id = setTimeout(() => setDone(null), 8000);
    return () => clearTimeout(id);
  }, [done]);

  function reset() {
    abort.current?.abort();
    setPhase({ name: "choose" });
    setFile(null);
    setConsent(false);
    setEdited({});
    setPicked({});
  }

  async function choose(f: File | undefined) {
    if (!f) return;
    const prepared = await prepareImage(f);
    if ("error" in prepared) return setPhase({ name: "error", code: prepared.error === "too_large" ? "too_large" : "unreadable" });
    setFile(prepared.file);
    setPhase({ name: "ready" });
  }

  async function analyse() {
    if (!file || !consent) return;
    setPhase({ name: "working" });
    const ctl = new AbortController();
    abort.current = ctl;
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    form.set("consent", "1");
    form.set("locale", locale);
    try {
      const res = await fetch("/api/ai-input/vision", { method: "POST", body: form, signal: ctl.signal });
      const body = (await res.json().catch(() => null)) as { ok: boolean; code?: string; result?: VisionResult } | null;
      if (!body?.ok || !body.result) return setPhase({ name: "error", code: body?.code ?? "network" });
      setEdited(Object.fromEntries(body.result.fields.map((f) => [f.key, f.value ?? ""])));
      // Only values printed in the image start ticked. Guesses and unknowns stay off until the person chooses them.
      setPicked(Object.fromEntries(body.result.fields.map((f) => [f.key, f.source === "read" && !!f.value])));
      setPhase({ name: "review", result: body.result });
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setPhase({ name: "error", code: "network" });
    }
  }

  function apply(result: VisionResult) {
    const out: AppliedField[] = result.fields
      .filter((f) => picked[f.key] && edited[f.key]?.trim())
      .map((f) => ({ key: f.key, value: edited[f.key].trim(), unit: f.unit }));
    const placed = onApply(out);
    setDone(typeof placed === "number" ? placed : out.length);
    setOpen(false);
    reset();
  }

  const acceptTypes = kind === "drawing" || kind === "material_label" ? "image/*,application/pdf" : "image/*";
  const SOURCE: Record<VisionField["source"], { text: string; cls: string }> = {
    read: { text: t("Read from the image"), cls: "bg-(--status-verified-bg) text-(--status-verified-fg)" },
    inferred: { text: t("AI guess"), cls: "bg-(--status-estimate-bg) text-(--status-estimate-fg)" },
    unknown: { text: t("Not readable"), cls: "bg-(--status-missing-bg) text-(--status-missing-fg)" },
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <ScanSearch aria-hidden /> {label ?? TITLES[kind]}
        </Button>
        {done !== null && (
          <p role="status" className="text-xs text-muted-foreground">
            {done > 0 ? t("{count} values were added to the form. Check them, then save as usual.", { count: done }) : t("Nothing was added.")}
          </p>
        )}
      </div>

      <AssistDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        title={TITLES[kind]}
      >
        {(phase.name === "choose" || phase.name === "error") && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{HINTS[kind]}</p>
            {phase.name === "error" && (
              <p role="alert" className="flex gap-2 rounded-md border border-(--status-missing-border) bg-(--status-missing-bg) p-3 text-sm text-(--status-missing-fg)">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {failure(phase.code as never)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-secondary focus-within:outline-2 focus-within:outline-ring md:h-10">
                <Camera aria-hidden className="size-4" /> {t("Take a photo")}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
              </label>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-secondary focus-within:outline-2 focus-within:outline-ring md:h-10">
                <FileUp aria-hidden className="size-4" /> {t("Choose a file")}
                <input type="file" accept={acceptTypes} className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{t("You can also close this and type the details in yourself.")}</p>
          </div>
        )}

        {(phase.name === "ready" || phase.name === "working") && file && (
          <div className="space-y-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t("Preview of the photo you chose")} className="mx-auto max-h-64 rounded-md border object-contain" />
            ) : (
              <p className="rounded-md border bg-muted p-3 text-sm">{t("A PDF is ready to send.")}</p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-(--brand-teal)" disabled={phase.name === "working"} />
              <span>{t("I agree that this picture is sent to an outside AI service (the one this server is set up with, for example Google Gemini) to be read. It is used for this one request and is not stored by Atlas. Do not send pictures with people in them.")}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void analyse()} disabled={!consent || phase.name === "working"}>
                {phase.name === "working" ? <><Loader2 aria-hidden className="animate-spin" /> {t("Reading…")}</> : t("Read it")}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                {t("Choose a different file")}
              </Button>
            </div>
          </div>
        )}

        {phase.name === "review" && (
          <div className="space-y-4">
            {phase.result.summary && <p className="text-sm">{phase.result.summary}</p>}
            {phase.result.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Nothing could be read. Try a sharper photo, or type the details in yourself.")}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t("Check each value against the picture and correct it if needed. Only ticked values are added to the form. Guesses start unticked.")}</p>
                <ul className="divide-y rounded-md border">
                  {phase.result.fields.map((f) => (
                    <li key={f.key} className="grid gap-2 p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)]">
                      <input
                        type="checkbox"
                        checked={!!picked[f.key]}
                        disabled={!edited[f.key]?.trim()}
                        onChange={(e) => setPicked((p) => ({ ...p, [f.key]: e.target.checked }))}
                        aria-label={`${t("Use")}: ${labelText(t, f.label)}`}
                        className="mt-2 accent-(--brand-teal)"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={`va-${f.key}`} className="text-sm font-medium">{labelText(t, f.label)}</label>
                          <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", SOURCE[f.source].cls)}>{SOURCE[f.source].text}</span>
                          {f.unit && <span className="text-xs text-muted-foreground">{t("Unit")}: {f.unit}</span>}
                        </div>
                        <input
                          id={`va-${f.key}`}
                          value={edited[f.key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEdited((m) => ({ ...m, [f.key]: v }));
                            if (v.trim()) setPicked((p) => (f.key in p && p[f.key] !== undefined ? p : { ...p, [f.key]: true }));
                          }}
                          placeholder={f.source === "unknown" ? t("Not readable: type it in if you know it") : undefined}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        />
                        {f.note && <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {phase.result.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-(--status-estimate-fg)">
                {phase.result.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5"><CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {w}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{t("Read by AI. Not checked by anyone. Units are shown exactly as printed.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => apply(phase.result)} disabled={!phase.result.fields.some((f) => picked[f.key] && edited[f.key]?.trim())}>
                {t("Add ticked values to the form")}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        )}
      </AssistDialog>
    </>
  );
}

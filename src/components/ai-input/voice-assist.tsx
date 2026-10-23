"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistDialog, useAiAvailable, useFailureText } from "@/components/ai-input/shared";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { browserSpeechSupported, recordingSupported, startBrowserSpeech, startRecording, type BrowserSpeech, type Recording } from "@/lib/ai-input/browser";
import { fillById } from "@/lib/ai-input/fill";
import { localExtract } from "@/lib/ai-input/local-extract";
import { AUDIO_LIMITS } from "@/lib/ai-input/upload";
import type { VoiceResult, VoiceRow, VoiceTarget } from "@/lib/ai-input/voice";
import { MATERIAL_NAMES, PROCESS_NAMES } from "@/lib/opportunities/engine";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "processing" | "text";

/**
 * A microphone for any text field, or for a group of fields. Speech becomes editable text; for a group of facts the AI (or, with no
 * AI, a simple word matcher) proposes values that the person reviews. Nothing is saved or overwritten: text is added after what is
 * already in the field, and proposed values are applied only when ticked and confirmed.
 *
 * - `target="text"` with `fieldId`: the confirmed text is added to that field.
 * - `target="factory" | "product"` with `onRows`: ticked rows are handed to the form that owns them.
 */
export function VoiceAssist({
  target = "text",
  fieldId,
  onText,
  onRows,
  label,
  className,
  compact = false,
}: {
  target?: VoiceTarget;
  fieldId?: string;
  onText?: (text: string) => void;
  onRows?: (rows: VoiceRow[]) => number | void;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const failure = useFailureText();
  const ai = useAiAvailable();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [consent, setConsent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [english, setEnglish] = useState("");
  const [useEnglish, setUseEnglish] = useState(false);
  const [rows, setRows] = useState<VoiceRow[]>([]);
  const [ticked, setTicked] = useState<boolean[]>([]);
  const [done, setDone] = useState<string | null>(null);
  // When the AI service cannot take audio (for example out of credit), the browser's own recogniser is used instead.
  const [aiAudioFailed, setAiAudioFailed] = useState(false);
  const rec = useRef<Recording | null>(null);
  const speech = useRef<BrowserSpeech | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI when the server has it (best for Hindi, Gujarati and mixed speech); else the browser's own recogniser; else typing only.
  const effective: "ai" | "browser" | "none" = ai && !(aiAudioFailed && browserSpeechSupported()) ? "ai" : ai !== null && browserSpeechSupported() ? "browser" : "none";
  const engine = effective;
  useEffect(() => () => hardStop(), []); // leaving the page always releases the microphone
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(null), 8000);
    return () => clearTimeout(id);
  }, [done]);

  function hardStop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    rec.current?.cancel();
    rec.current = null;
    speech.current?.cancel();
    speech.current = null;
  }

  function reset() {
    hardStop();
    setPhase("idle");
    setError(null);
    setTranscript("");
    setEnglish("");
    setUseEnglish(false);
    setRows([]);
    setTicked([]);
    setSeconds(0);
  }

  function tick() {
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function showResult(r: { transcript: string; english?: string; rows: VoiceRow[] }) {
    setTranscript(r.transcript);
    setEnglish(r.english ?? "");
    setRows(r.rows);
    setTicked(r.rows.map(() => false));
    setPhase("text");
  }

  async function post(form: FormData): Promise<VoiceResult | null> {
    form.set("target", target);
    form.set("consent", "1");
    form.set("locale", locale);
    try {
      const res = await fetch("/api/ai-input/voice", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; code?: string; result?: VoiceResult } | null;
      if (!body?.ok || !body.result) {
        if (body?.code === "out_of_credit" || body?.code === "not_configured") setAiAudioFailed(true);
        setError(failure((body?.code ?? "network") as never));
        return null;
      }
      return body.result;
    } catch {
      setError(failure("network"));
      return null;
    }
  }

  async function start() {
    setError(null);
    if (engine === "ai") {
      if (!consent) return setError(failure("consent_required"));
      try {
        rec.current = await startRecording(() => void stop());
      } catch (e) {
        return setError(failure(e === "denied" ? "denied" : e === "no_device" ? "no_device" : e === "unsupported" ? "unsupported_browser" : "mic_failed"));
      }
      setPhase("recording");
      tick();
    } else if (engine === "browser") {
      setPhase("recording");
      tick();
      speech.current = startBrowserSpeech(
        LOCALE_NAMES[locale].bcp47,
        (text) => setTranscript(text),
        (err) => {
          if (timer.current) clearInterval(timer.current);
          speech.current = null;
          setTranscript((cur) => {
            if (!cur.trim()) setError(failure(err === "not-allowed" || err === "service-not-allowed" ? "denied" : err === "no-speech" ? "silent" : "mic_failed"));
            return cur;
          });
          setRows(localExtract(target, ""));
          setPhase("text");
        },
      );
    }
  }

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (engine === "browser") return speech.current?.stop();
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    setPhase("processing");
    try {
      const clip = await r.stop();
      if (clip.silent) {
        setError(failure("silent"));
        return setPhase("idle");
      }
      const form = new FormData();
      form.set("audio", new File([clip.wav], "clip.wav", { type: "audio/wav" }));
      const result = await post(form);
      if (!result) return setPhase("idle");
      showResult(result);
    } catch {
      setError(failure("mic_failed"));
      setPhase("idle");
    }
  }

  /** Looks for fields again in the (possibly edited) text: with the AI when it is on and agreed to, else with the offline word matcher. */
  async function findFields() {
    const text = (useEnglish && english ? english : transcript).trim();
    if (!text || target === "text") return;
    setError(null);
    if (engine === "ai" && consent) {
      setPhase("processing");
      const form = new FormData();
      form.set("text", text);
      const result = await post(form);
      if (result) {
        setRows(result.rows);
        setTicked(result.rows.map(() => false));
      }
      setPhase("text");
    } else {
      const r = localExtract(target, text);
      setRows(r);
      setTicked(r.map(() => false));
    }
  }

  function addText() {
    const text = (useEnglish && english ? english : transcript).trim();
    if (!text) return;
    if (fieldId) fillById(fieldId, text, "append");
    onText?.(text);
    setDone(t("Added to the field. Check it, then save as usual."));
    setOpen(false);
    reset();
  }

  function applyRows() {
    const chosen = rows.filter((_, i) => ticked[i]);
    const placed = onRows?.(chosen);
    const n = typeof placed === "number" ? placed : chosen.length;
    setDone(n ? t("{count} values were added to the form. Check them, then save as usual.", { count: n }) : t("Nothing was added."));
    setOpen(false);
    reset();
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const noMic = ai !== null && engine === "none" && !recordingSupported();

  return (
    <>
      <div className={cn("inline-flex flex-wrap items-center gap-2", className)}>
        <Button type="button" variant="outline" size={compact ? "icon-sm" : "sm"} onClick={() => setOpen(true)} aria-label={label ?? t("Speak instead of typing")} title={label ?? t("Speak instead of typing")} className="gap-1.5">
          <Mic aria-hidden />
          {!compact && <span>{label ?? t("Speak")}</span>}
        </Button>
        {done && (
          <p role="status" className="text-xs text-muted-foreground">
            {done}
          </p>
        )}
      </div>

      <AssistDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        title={target === "factory" ? t("Describe your factory by voice") : target === "product" ? t("Describe your product by voice") : t("Speak instead of typing")}
      >
        <div className="space-y-4">
          {phase === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                {target === "factory"
                  ? t("Say what your factory makes, how many machines you have and which plastics you use. You can speak in English, Hindi, Gujarati or a mix.")
                  : target === "product"
                    ? t("Say the product name, what it is for, its material and weight. You can speak in English, Hindi, Gujarati or a mix.")
                    : t("Speak your answer in English, Hindi, Gujarati or a mix. You can edit the text before it is added.")}
              </p>
              {engine === "ai" && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-(--brand-teal)" />
                  <span>{t("I agree that my recording is sent to an outside AI service (the one this server is set up with, for example Google Gemini) to be turned into text. It is used for this one request and is not stored by Atlas.")}</span>
                </label>
              )}
              {engine === "browser" && <p className="rounded-md bg-muted p-3 text-xs">{t("The AI service is off, so your browser's own speech recognition will be used. Depending on the browser, it may send audio to its maker. Hindi and Gujarati may be less accurate.")}</p>}
              {(engine === "none" || noMic) && <p className="rounded-md bg-muted p-3 text-sm">{t("Voice input is not available in this browser. You can type or paste your note below and use it the same way.")}</p>}
              {error && <p role="alert" className="flex gap-2 rounded-md border border-(--status-missing-border) bg-(--status-missing-bg) p-3 text-sm text-(--status-missing-fg)"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}</p>}
              <div className="flex flex-wrap gap-2">
                {(engine === "ai" || engine === "browser") && (
                  <Button type="button" onClick={() => void start()} disabled={engine === "ai" && !consent}>
                    <Mic aria-hidden /> {t("Start recording")}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => { setError(null); setPhase("text"); }}>
                  {t("Type instead")}
                </Button>
              </div>
            </>
          )}

          {phase === "recording" && (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span aria-hidden className="size-2.5 rounded-full bg-(--status-missing-fg) motion-safe:animate-pulse" />
                {t("Recording…")} <span className="tnum text-muted-foreground">{mm} / {Math.floor(AUDIO_LIMITS.maxSeconds / 60)}:00</span>
              </p>
              {engine === "browser" && transcript && <p className="rounded-md border p-3 text-sm">{transcript}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void stop()}>
                  <Square aria-hidden /> {t("Stop")}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  {t("Cancel")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("Recording stops as soon as you press Stop. Atlas never listens in the background.")}</p>
            </div>
          )}

          {phase === "processing" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> {t("Turning your voice into text…")}
            </p>
          )}

          {phase === "text" && (
            <>
              {error && <p role="alert" className="flex gap-2 rounded-md border border-(--status-missing-border) bg-(--status-missing-bg) p-3 text-sm text-(--status-missing-fg)"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}</p>}
              <div>
                <label htmlFor="voice-transcript" className="text-sm font-medium">{t("What was heard (you can edit it)")}</label>
                <textarea
                  id="voice-transcript"
                  value={useEnglish && english ? english : transcript}
                  onChange={(e) => (useEnglish && english ? setEnglish(e.target.value) : setTranscript(e.target.value))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm"
                  lang={useEnglish ? "en" : locale}
                />
                {english && english !== transcript && (
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={useEnglish} onChange={(e) => setUseEnglish(e.target.checked)} className="accent-(--brand-teal)" />
                    {t("Use the English version")}
                  </label>
                )}
              </div>

              {target !== "text" && (
                <div className="space-y-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void findFields()} disabled={!transcript.trim()}>
                    {t("Find the fields in this text")}
                  </Button>
                  {engine !== "ai" && <p className="text-xs text-muted-foreground">{t("Without the AI service only known process, material and number words are matched. Anything else you type in yourself.")}</p>}
                  {rows.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground">{t("Tick what is right. Only ticked values are added, and nothing is saved until you save the form.")}</p>
                      <ul className="divide-y rounded-md border">
                        {rows.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 p-3 text-sm">
                            <input type="checkbox" checked={!!ticked[i]} onChange={(e) => setTicked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} aria-label={t("Use")} className="mt-1 accent-(--brand-teal)" />
                            <div className="min-w-0">
                              <p className="font-medium">
                                {r.kind === "process" && `${t("Process")}: ${t(PROCESS_NAMES[r.code])}`}
                                {r.kind === "material" && `${t("Material")}: ${t(MATERIAL_NAMES[r.code] ?? r.code)}`}
                                {r.kind === "machine" && `${t("Machines")}: ${t(PROCESS_NAMES[r.process])} × ${r.count}${r.size ? `, ${r.size}` : ""}`}
                                {r.kind === "product" && `${t("Product")}: ${r.name}`}
                                {r.kind === "field" && `${t(r.label)}: ${r.value}`}
                              </p>
                              {r.quote && <p className="text-xs text-muted-foreground">{t("You said")}: “{r.quote}”</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("No fields found yet.")}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {target === "text" || !onRows ? (
                  <Button type="button" onClick={addText} disabled={!(useEnglish && english ? english : transcript).trim()}>
                    {t("Add to the field")}
                  </Button>
                ) : (
                  <Button type="button" onClick={applyRows} disabled={!ticked.some(Boolean)}>
                    {t("Add ticked values to the form")}
                  </Button>
                )}
                {target !== "text" && fieldId && (
                  <Button type="button" variant="outline" onClick={addText} disabled={!transcript.trim()}>
                    {t("Add the text only")}
                  </Button>
                )}
                {(engine === "ai" || engine === "browser") && (
                  <Button type="button" variant="outline" onClick={() => { setPhase("idle"); setError(null); }}>
                    {t("Record again")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("Turned into text by AI. It may mishear numbers and technical words: please check.")}</p>
            </>
          )}
        </div>
      </AssistDialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { XIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { inputCapabilities } from "@/lib/actions/ai-input";
import type { InputFailureCode } from "@/lib/ai-input/server-codes";

// One question per page, however many microphones it has.
let asked: Promise<boolean> | null = null;
const askOnce = () => (asked ??= inputCapabilities().then((c) => c.ai, () => { asked = null; return false; }));

/** Whether the server's AI is on. null while it is being asked. */
export function useAiAvailable(): boolean | null {
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    askOnce().then((v) => live && setAi(v));
    return () => {
      live = false;
    };
  }, []);
  return ai;
}

/** One translated sentence for every failure the endpoints and the browser can report. Nothing from a provider is ever shown. */
export function useFailureText() {
  const t = useT();
  return (code: InputFailureCode | "network" | "silent" | "denied" | "no_device" | "mic_failed" | "unsupported_browser" | "unreadable"): string => {
    switch (code) {
      case "not_configured":
        return t("The AI service is not switched on for this account. You can keep typing, or ask whoever runs the server to enable it.");
      case "consent_required":
        return t("Please tick the box to agree before sending.");
      case "quota":
        return t("You have used the AI limit for this hour. Please try again later, or type it in.");
      case "out_of_credit":
        return t("The AI service has run out of credit, so it cannot help right now. You can keep typing. Voice can still use your browser's own speech recognition if it has one.");
      case "too_large":
        return t("That file is too large. Use a smaller photo or a shorter recording.");
      case "unsupported":
        return t("That file type is not supported. Use a JPG, PNG, WebP or HEIC photo, or a PDF where a document is allowed.");
      case "empty":
        return t("That file is empty.");
      case "bad_output":
        return t("The AI could not read that clearly. Try a sharper photo or speak again, or type it in.");
      case "unauthorized":
        return t("Please sign in again.");
      case "network":
        return t("The connection failed. Nothing was changed. Try again.");
      case "silent":
        return t("Nothing was heard. Check the microphone and try again.");
      case "denied":
        return t("Microphone access was blocked. Allow it in your browser settings, or type instead.");
      case "no_device":
        return t("No microphone was found. Type instead.");
      case "mic_failed":
        return t("The microphone could not start. Type instead.");
      case "unsupported_browser":
        return t("This browser cannot record audio. Type instead.");
      case "unreadable":
        return t("That photo could not be opened. Try another one.");
      default:
        return t("The AI service had a problem. Nothing was changed. Try again, or type it in.");
    }
  };
}

/** Shared dialog frame, styled like the rest of the app. */
export function AssistDialog({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="atlas-fade fixed inset-0 z-50 bg-[#16233f]/40" />
        <Dialog.Content aria-describedby={undefined} className="atlas-pop fixed inset-x-3 top-[6vh] z-50 mx-auto flex max-h-[88vh] max-w-xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl outline-none">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="text-[15px] font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-md hover:bg-secondary" aria-label={t("Close")}>
              <XIcon className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

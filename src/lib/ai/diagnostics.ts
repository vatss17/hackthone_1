import { AiError, type AiErrorCode } from "./provider.ts";

/**
 * Server-side diagnostics for AI failures. A line says WHICH step failed and why, using fixed-format fields only.
 * It never contains a key, an authorization header, a prompt, a response body, a catalogue or any manufacturer data.
 * Unknown (non-AI) errors are reduced to their class name plus a short message with anything key-like removed.
 */

const SECRET_LIKE = [/AIza[0-9A-Za-z_-]{10,}/g, /sk-[0-9A-Za-z_-]{8,}/g, /Bearer\s+\S+/gi, /(?:api[-_ ]?key|token|secret|authorization)\s*[:=]\s*\S+/gi, /[A-Za-z0-9_-]{32,}/g];

export function redact(text: string, max = 160): string {
  let t = text.replace(/\s+/g, " ").trim();
  for (const re of SECRET_LIKE) t = t.replace(re, "<redacted>");
  return t.slice(0, max);
}

export interface FailureContext {
  op: "explain" | "extract" | "atlas-route" | "vision" | "voice";
  provider: string;
  model: string;
  ms: number;
}

export function failureLine(ctx: FailureContext, e: unknown): { code: AiErrorCode | "unexpected"; line: string } {
  const head = `[ai] ${ctx.op} failed on ${ctx.provider}/${ctx.model} after ${ctx.ms}ms`;
  if (e instanceof AiError) {
    const d = e.detail;
    const parts = [d.http !== undefined && `http=${d.http}`, d.status && `status=${d.status}`, d.reason && `reason=${d.reason}`, d.finishReason && `finish=${d.finishReason}`, d.note && `note="${redact(d.note, 80)}"`].filter(Boolean);
    return { code: e.code, line: `${head}: ${e.code}${parts.length ? ` (${parts.join(" ")})` : ""}` };
  }
  const name = (e as { name?: string })?.name ?? "Error";
  const msg = e instanceof Error ? redact(e.message) : "";
  return { code: "unexpected", line: `${head}: unexpected ${redact(name, 40)}${msg ? ` - ${msg}` : ""} (this happened in our code, not at the provider, and is shown to the user as a generic provider error)` };
}

/** Writes one sanitized line to the server log. */
export function logAiFailure(ctx: FailureContext, e: unknown): void {
  console.error(failureLine(ctx, e).line);
}

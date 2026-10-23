import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentOrganization } from "@/lib/organization";
import { aiStatus, AiError, AI_ERROR_MESSAGES, createProvider, withinLimit, type AiErrorCode, type AiProvider } from "@/lib/ai/provider";
import { parseLocale, type Locale } from "@/lib/i18n/config";
import type { InputFailureCode } from "./server-codes";

/** Failure codes the browser maps to translated messages. Nothing here ever echoes a prompt, a file or a provider response. */
export type { InputFailureCode };
export interface InputFailure {
  ok: false;
  code: InputFailureCode;
  error: string;
}

export const failure = (code: InputFailureCode): InputFailure => ({ ok: false, code, error: code in AI_ERROR_MESSAGES ? AI_ERROR_MESSAGES[code as AiErrorCode] : "That could not be used. Nothing was changed." });
export const STATUS: Partial<Record<InputFailureCode, number>> = { unauthorized: 401, consent_required: 400, bad_request: 400, empty: 400, unsupported: 415, too_large: 413, quota: 429, not_configured: 503 };
export const respond = (f: InputFailure) => Response.json(f, { status: STATUS[f.code] ?? 502 });

export interface Guarded {
  userId: string;
  provider: AiProvider;
  locale: Locale;
}

/**
 * Every AI input endpoint starts here: a signed-in company member, the operator's AI settings, the person's consent for THIS
 * request, and a per-user hourly limit shared with the other AI features.
 */
export async function guard(form: FormData, bucket: string): Promise<Guarded | InputFailure> {
  const user = await getCurrentUser();
  if (!user) return failure("unauthorized");
  if (!(await getCurrentOrganization())) return failure("unauthorized");
  if (!aiStatus(process.env).configured) return failure("not_configured");
  if (form.get("consent") !== "1") return failure("consent_required");
  const provider = createProvider(process.env);
  if (!provider) return failure("not_configured");
  const perHour = Math.max(1, Math.min(200, Number(process.env.AI_MAX_CALLS_PER_HOUR) || 20));
  if (!withinLimit(`${bucket}:${user.id}`, perHour * 2)) return failure("quota");
  return { userId: user.id, provider, locale: parseLocale(form.get("locale")) };
}

export const isFailure = (v: Guarded | InputFailure): v is InputFailure => "ok" in v;
export const codeOf = (e: unknown): InputFailureCode => (e instanceof AiError ? e.code : "provider_error");

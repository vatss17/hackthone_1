/**
 * AI provider adapter. Server-side only (it reads credentials from the environment).
 *
 * Authorisation model, all of which must hold before any call can be made:
 *   1. AI_PROVIDER=anthropic          the operator chose a provider on purpose
 *   2. ANTHROPIC_API_KEY              a credential the operator supplied for this app
 *   3. AI_DATA_APPROVED=1             the operator confirms sending business data to that provider is approved
 *   4. the user ticks consent on each use, in the interface
 * The endpoint is fixed. The adapter deliberately ignores ANTHROPIC_BASE_URL and any other variable that a
 * development tool may set, so credentials meant for something else are never picked up by accident.
 * Keys are never logged, returned or placed in error messages, and neither are prompts or responses.
 */

export type AiErrorCode = "not_configured" | "timeout" | "rate_limited" | "provider_error" | "bad_output" | "too_large" | "consent_required" | "quota";

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI is not configured on this server.",
  timeout: "The AI provider took too long to answer. Nothing was changed. Try again, or continue without AI.",
  rate_limited: "The AI provider is busy. Try again in a minute.",
  provider_error: "The AI provider could not answer right now. Nothing was changed.",
  bad_output: "The AI answer could not be used because it did not pass validation. Nothing was changed.",
  too_large: "That is too long to send to AI. Use a shorter excerpt.",
  consent_required: "Tick the consent box to send this information to the AI provider.",
  quota: "The hourly AI limit for this server has been reached. Try later, or continue without AI.",
};

export interface AiRequest {
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}

export interface AiProvider {
  name: string;
  model: string;
  complete(req: AiRequest): Promise<string>;
}

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  /** Exact, non-secret reasons the feature is off, for the operator. */
  missing: string[];
}

type Env = Record<string, string | undefined>;

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const ENDPOINT = "https://api.anthropic.com/v1/messages";

export function aiStatus(env: Env): AiStatus {
  const missing: string[] = [];
  if (env.AI_PROVIDER !== "anthropic") missing.push("AI_PROVIDER=anthropic");
  if (!env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (env.AI_DATA_APPROVED !== "1") missing.push("AI_DATA_APPROVED=1 (after a data-processing and hosting decision)");
  const configured = missing.length === 0;
  return { configured, provider: configured ? "anthropic" : null, model: configured ? env.AI_MODEL || DEFAULT_MODEL : null, missing };
}

export function createProvider(env: Env, fetchImpl: typeof fetch = fetch): AiProvider | null {
  const status = aiStatus(env);
  if (!status.configured) return null;
  const key = env.ANTHROPIC_API_KEY as string;
  const model = status.model as string;
  return {
    name: "anthropic",
    model,
    async complete(req) {
      let res: Response;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: req.maxTokens, temperature: 0, system: req.system, messages: [{ role: "user", content: req.user }] }),
          signal: AbortSignal.timeout(req.timeoutMs),
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        throw new AiError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "provider_error", AI_ERROR_MESSAGES[name === "TimeoutError" || name === "AbortError" ? "timeout" : "provider_error"]);
      }
      if (res.status === 429) throw new AiError("rate_limited", AI_ERROR_MESSAGES.rate_limited);
      if (!res.ok) throw new AiError("provider_error", AI_ERROR_MESSAGES.provider_error);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new AiError("provider_error", AI_ERROR_MESSAGES.provider_error);
      }
      const content = (body as { content?: { type?: string; text?: string }[] })?.content;
      const text = Array.isArray(content) ? content.filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text).join("") : "";
      if (!text) throw new AiError("provider_error", AI_ERROR_MESSAGES.provider_error);
      return text;
    },
  };
}

// ---- a small per-process usage limit, so a loop or a curious click cannot run up a bill ----------

const calls = new Map<string, number[]>();

export function withinLimit(key: string, max: number, windowMs = 3_600_000, now = Date.now()): boolean {
  const recent = (calls.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    calls.set(key, recent);
    return false;
  }
  recent.push(now);
  calls.set(key, recent);
  return true;
}

export const resetLimits = () => calls.clear();

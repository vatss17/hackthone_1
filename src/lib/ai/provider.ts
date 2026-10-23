/**
 * AI provider adapter. Server-side only (it reads credentials from the environment).
 *
 * Authorisation model, all of which must hold before any call can be made:
 *   1. AI_PROVIDER=anthropic|gemini   the operator chose a provider on purpose
 *   2. ANTHROPIC_API_KEY or GEMINI_API_KEY   a credential the operator supplied for this app
 *   3. AI_DATA_APPROVED=1             the operator confirms sending business data to that provider is approved
 *   4. the user ticks consent on each use, in the interface
 * Each endpoint is fixed. The adapter deliberately ignores ANTHROPIC_BASE_URL and any other variable that a
 * development tool may set, so credentials meant for something else are never picked up by accident.
 * Keys are never logged, returned or placed in error messages, and neither are prompts or responses.
 */

export type AiErrorCode =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "provider_error"
  | "bad_output"
  | "too_large"
  | "consent_required"
  | "quota"
  | "out_of_credit"
  | "invalid_config"
  | "model_unavailable"
  | "unavailable"
  | "blocked"
  | "bad_request";

/** What may be recorded about a failure. Only fixed-format fields: never a key, a prompt, a response body or any manufacturer data. */
export interface AiErrorDetail {
  http?: number;
  /** The provider's error status or type, for example PERMISSION_DENIED. Letters, digits and underscores only. */
  status?: string;
  /** The provider's machine-readable reason, for example API_KEY_INVALID. */
  reason?: string;
  finishReason?: string;
  /** A short fixed phrase from this code, for example "not json". */
  note?: string;
}

export class AiError extends Error {
  code: AiErrorCode;
  detail: AiErrorDetail;
  constructor(code: AiErrorCode, message: string, detail: AiErrorDetail = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI is not configured on this server.",
  timeout: "The AI request timed out. Nothing was changed. Try again, or continue without AI.",
  rate_limited: "The AI provider's usage limit was reached, or it is busy. Wait a minute and try again. If it keeps happening, check the provider's quota and billing. Nothing was changed.",
  provider_error: "The AI provider could not answer right now. Nothing was changed.",
  bad_output: "The AI answer did not pass our checks, so it was not used. Nothing was changed. You can try again.",
  too_large: "That is too long to send to AI. Use a shorter excerpt.",
  consent_required: "Tick the consent box to send this information to the AI provider.",
  out_of_credit: "The AI provider account has no credit left for this request. Whoever runs the server needs to add credit. Nothing was changed.",
  quota: "The hourly AI limit for this server has been reached. Try later, or continue without AI.",
  invalid_config: "The AI provider did not accept this server's key or settings. Whoever runs the server needs to check the API key and any restrictions on it. Nothing was changed.",
  model_unavailable: "The chosen AI model cannot be used with this key. It may have been retired for newer keys. Whoever runs the server needs to pick a current model. Nothing was changed.",
  unavailable: "The AI provider is temporarily unavailable. Try again in a few minutes. Nothing was changed.",
  blocked: "The AI provider declined to answer this request. Nothing was changed. Continue without AI.",
  bad_request: "The AI provider rejected the request. This is a setup problem for whoever runs the server. Nothing was changed.",
};

/** An image, PDF or audio clip sent with the prompt: base64 data, never stored by this app. */
export interface AiAttachment {
  mimeType: string;
  data: string;
}

export interface AiRequest {
  system: string;
  user: string;
  /** Optional images, PDFs or audio for multimodal requests (Gemini: all three; Anthropic: images and PDFs only). */
  attachments?: AiAttachment[];
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
/**
 * Gemini default. Google retires models for new keys while still listing them: gemini-2.5-* answered "no longer available to new
 * users" (404) for a new key even though the model list and metadata still showed it. Confirm with `npm run ai:readiness -- --check-provider`.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Extra output tokens for models that reason before answering. Worst case a few thousandths of a dollar per call. */
export const GEMINI_REASONING_HEADROOM = 2048;

/**
 * OpenRouter: one key that reaches many models through an OpenAI-style endpoint. The default is the same Gemini model, which reads
 * images, PDFs and audio. The model name here is "vendor/model" and goes in the request body, never in the URL.
 */
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.8-flash";

type ProviderName = "anthropic" | "gemini" | "openrouter";
const PROVIDER_NAMES: ProviderName[] = ["anthropic", "gemini", "openrouter"];
const PROVIDERS: Record<ProviderName, { keyVar: string; defaultModel: string }> = {
  anthropic: { keyVar: "ANTHROPIC_API_KEY", defaultModel: DEFAULT_MODEL },
  gemini: { keyVar: "GEMINI_API_KEY", defaultModel: DEFAULT_GEMINI_MODEL },
  openrouter: { keyVar: "OPENROUTER_API_KEY", defaultModel: DEFAULT_OPENROUTER_MODEL },
};

/** A plain model name only, so an environment value can never change the URL it is placed in. */
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const SAFE_ROUTED_MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}\/[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/;

export function aiStatus(env: Env): AiStatus {
  const missing: string[] = [];
  const chosen = PROVIDER_NAMES.includes(env.AI_PROVIDER as ProviderName) ? (env.AI_PROVIDER as ProviderName) : null;
  if (!chosen) missing.push("AI_PROVIDER=anthropic, AI_PROVIDER=gemini or AI_PROVIDER=openrouter");
  if (!chosen) missing.push("ANTHROPIC_API_KEY or GEMINI_API_KEY or OPENROUTER_API_KEY (the one for your provider)");
  else if (!env[PROVIDERS[chosen].keyVar]) missing.push(PROVIDERS[chosen].keyVar);
  if (env.AI_DATA_APPROVED !== "1") missing.push("AI_DATA_APPROVED=1 (after a data-processing and hosting decision)");
  const model = chosen ? env.AI_MODEL || PROVIDERS[chosen].defaultModel : null;
  if (model && !(chosen === "openrouter" ? SAFE_ROUTED_MODEL : SAFE_MODEL).test(model)) missing.push(chosen === "openrouter" ? "AI_MODEL must look like vendor/model" : "AI_MODEL must be a plain model name");
  const configured = missing.length === 0;
  return { configured, provider: configured ? chosen : null, model: configured ? model : null, missing };
}

const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9_]{2,60}$/;
const token = (v: unknown): string | undefined => (typeof v === "string" && SAFE_TOKEN.test(v) ? v : undefined);

/** Reads only the fixed-format fields of a provider error body. The message text is never kept. */
export function errorFields(body: unknown): Pick<AiErrorDetail, "status" | "reason"> {
  const e = (body as { error?: { status?: unknown; type?: unknown; details?: unknown } } | null)?.error;
  if (!e || typeof e !== "object") return {};
  const details = Array.isArray(e.details) ? (e.details as { reason?: unknown }[]) : [];
  return { status: token(e.status) ?? token(e.type), reason: details.map((d) => token(d?.reason)).find(Boolean) };
}

/** Maps a failed HTTP response to a category people can act on. */
export function classifyHttp(http: number, body: unknown): AiError {
  const f = errorFields(body);
  const detail: AiErrorDetail = { http, ...f };
  const make = (code: AiErrorCode) => new AiError(code, AI_ERROR_MESSAGES[code], detail);
  if (http === 402) return make("out_of_credit");
  if (http === 429 || f.status === "RESOURCE_EXHAUSTED") return make("rate_limited");
  if (http === 401 || http === 403 || f.reason === "API_KEY_INVALID" || f.status === "UNAUTHENTICATED" || f.status === "PERMISSION_DENIED") return make("invalid_config");
  if (http === 404 || f.status === "NOT_FOUND") return make("model_unavailable");
  if (http === 400) return make("bad_request");
  if (http === 408 || http === 504 || f.status === "DEADLINE_EXCEEDED") return make("timeout");
  if (http >= 500 || f.status === "UNAVAILABLE") return make("unavailable");
  return make("provider_error");
}

const failure = (e: unknown): AiError => {
  const name = (e as { name?: string })?.name;
  const timedOut = name === "TimeoutError" || name === "AbortError";
  const code: AiErrorCode = timedOut ? "timeout" : "provider_error";
  return new AiError(code, AI_ERROR_MESSAGES[code], { note: timedOut ? "request timed out" : `network error (${token(name) ?? "unknown"})` });
};

async function readJson(res: Response): Promise<unknown> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON: classify by status alone */
    }
    throw classifyHttp(res.status, body);
  }
  try {
    return await res.json();
  } catch {
    throw new AiError("provider_error", AI_ERROR_MESSAGES.provider_error, { http: res.status, note: "response was not JSON" });
  }
}

const empty = (detail: AiErrorDetail): never => {
  throw new AiError("provider_error", AI_ERROR_MESSAGES.provider_error, { ...detail, note: detail.note ?? "empty response" });
};

/** Anthropic accepts images and PDFs, not audio. Anything else is refused before a request is made. */
function anthropicBlocks(attachments: AiAttachment[] = []) {
  return attachments.map((a) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(a.mimeType)) return { type: "image", source: { type: "base64", media_type: a.mimeType, data: a.data } };
    if (a.mimeType === "application/pdf") return { type: "document", source: { type: "base64", media_type: a.mimeType, data: a.data } };
    throw new AiError("bad_request", AI_ERROR_MESSAGES.bad_request, { note: "attachment type not supported by this provider" });
  });
}

export function createProvider(env: Env, fetchImpl: typeof fetch = fetch): AiProvider | null {
  const status = aiStatus(env);
  if (!status.configured) return null;
  const name = status.provider as ProviderName;
  const key = env[PROVIDERS[name].keyVar] as string;
  const model = status.model as string;

  if (name === "openrouter") {
    return {
      name,
      model,
      async complete(req) {
        const parts: unknown[] = (req.attachments ?? []).map((a) => {
          if (a.mimeType.startsWith("image/")) return { type: "image_url", image_url: { url: `data:${a.mimeType};base64,${a.data}` } };
          if (a.mimeType === "application/pdf") return { type: "file", file: { filename: "document.pdf", file_data: `data:${a.mimeType};base64,${a.data}` } };
          if (a.mimeType.startsWith("audio/")) return { type: "input_audio", input_audio: { data: a.data, format: a.mimeType === "audio/mpeg" ? "mp3" : a.mimeType.replace("audio/", "") } };
          throw new AiError("bad_request", AI_ERROR_MESSAGES.bad_request, { note: "attachment type not supported" });
        });
        let res: Response;
        try {
          res = await fetchImpl(OPENROUTER_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "Atlas" },
            body: JSON.stringify({
              model,
              max_tokens: req.maxTokens + (model.startsWith("google/") ? GEMINI_REASONING_HEADROOM : 0),
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: req.system },
                { role: "user", content: parts.length ? [...parts, { type: "text", text: req.user }] : req.user },
              ],
            }),
            signal: AbortSignal.timeout(req.timeoutMs),
          });
        } catch (e) {
          throw failure(e);
        }
        const body = (await readJson(res)) as { choices?: { finish_reason?: unknown; message?: { content?: unknown } }[] };
        const choice = body?.choices?.[0];
        const content = choice?.message?.content;
        const text = typeof content === "string" ? content : Array.isArray(content) ? (content as { text?: string }[]).map((c) => (typeof c?.text === "string" ? c.text : "")).join("") : "";
        if (!text) return empty({ finishReason: token(choice?.finish_reason) });
        if (choice?.finish_reason === "length") throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { finishReason: "length", note: "answer was cut off" });
        return text;
      },
    };
  }

  if (name === "gemini") {
    return {
      name,
      model,
      async complete(req) {
        let res: Response;
        try {
          res = await fetchImpl(`${GEMINI_ENDPOINT_BASE}/${model}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: req.system }] },
              contents: [{ role: "user", parts: [...(req.attachments ?? []).map((a) => ({ inlineData: { mimeType: a.mimeType, data: a.data } })), { text: req.user }] }],
              // Newer Gemini models may spend part of the limit on hidden reasoning, so they get headroom. What we keep is still capped by validation.
              generationConfig: { maxOutputTokens: req.maxTokens + (model.startsWith("gemini-2.5") ? 0 : GEMINI_REASONING_HEADROOM), temperature: 0, responseMimeType: "application/json", ...(model.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
            }),
            signal: AbortSignal.timeout(req.timeoutMs),
          });
        } catch (e) {
          throw failure(e);
        }
        const body = (await readJson(res)) as { promptFeedback?: { blockReason?: unknown }; candidates?: { finishReason?: unknown; content?: { parts?: { text?: string }[] } }[] };
        const block = token(body?.promptFeedback?.blockReason);
        if (block) throw new AiError("blocked", AI_ERROR_MESSAGES.blocked, { reason: block, note: "prompt blocked" });
        const cand = body?.candidates?.[0];
        const finish = token(cand?.finishReason);
        const text = Array.isArray(cand?.content?.parts) ? cand!.content!.parts!.map((p) => (typeof p?.text === "string" ? p.text : "")).join("") : "";
        if (!text) {
          if (finish === "MAX_TOKENS") throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { finishReason: finish, note: "cut off before any text" });
          if (finish && finish !== "STOP") throw new AiError("blocked", AI_ERROR_MESSAGES.blocked, { finishReason: finish, note: "no text returned" });
          return empty({ finishReason: finish });
        }
        if (finish === "MAX_TOKENS") throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { finishReason: finish, note: "answer was cut off" });
        return text;
      },
    };
  }

  return {
    name,
    model,
    async complete(req) {
      let res: Response;
      const blocks = req.attachments?.length ? anthropicBlocks(req.attachments) : null;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: req.maxTokens, temperature: 0, system: req.system, messages: [{ role: "user", content: blocks ? [...blocks, { type: "text", text: req.user }] : req.user }] }),
          signal: AbortSignal.timeout(req.timeoutMs),
        });
      } catch (e) {
        throw failure(e);
      }
      const body = (await readJson(res)) as { content?: { type?: string; text?: string }[] };
      const content = body?.content;
      const text = Array.isArray(content) ? content.filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text).join("") : "";
      return text || empty({});
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

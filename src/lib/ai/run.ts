import { AiError, AI_ERROR_MESSAGES, type AiProvider } from "./provider.ts";
import { AI_TIMEOUT_MS, EXPLAIN_MAX_TOKENS, EXPLAIN_SYSTEM, EXTRACTION_MAX_CHARS, EXTRACTION_MAX_TOKENS, EXTRACTION_SYSTEM, explainUser, extractionUser } from "./prompts.ts";
import { allowedNumbers, isUsable, parseJsonObject, validateExplanation, validateExtraction, type ExplanationResult, type ExtractionResult } from "./schemas.ts";

/**
 * The two AI jobs, with the provider passed in so they can be tested without a network or a key.
 * Each returns validated suggestions for a person to review. Neither touches the database.
 */

export async function runExtraction(provider: AiProvider, text: string): Promise<ExtractionResult> {
  if (text.length > EXTRACTION_MAX_CHARS) throw new AiError("too_large", AI_ERROR_MESSAGES.too_large);
  const answer = await provider.complete({ system: EXTRACTION_SYSTEM, user: extractionUser(text), maxTokens: EXTRACTION_MAX_TOKENS, timeoutMs: AI_TIMEOUT_MS });
  const parsed = parseJsonObject(answer);
  if (!parsed) throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: "answer was not a JSON object" });
  const result = validateExtraction(parsed, text);
  if (result.products.length === 0 && result.rejected.length === 0) throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: "no products found in the answer" });
  return result;
}

export async function runExplanation(provider: AiProvider, payload: unknown): Promise<ExplanationResult> {
  const answer = await provider.complete({ system: EXPLAIN_SYSTEM, user: explainUser(payload), maxTokens: EXPLAIN_MAX_TOKENS, timeoutMs: AI_TIMEOUT_MS });
  const parsed = parseJsonObject(answer);
  if (!parsed) throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: "answer was not a JSON object" });
  const result = validateExplanation(parsed, allowedNumbers(payload));
  if (!isUsable(result.value)) throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: `nothing usable after checks (${result.dropped.length} items rejected)` });
  return result;
}

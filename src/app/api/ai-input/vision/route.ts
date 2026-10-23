import { AI_ERROR_MESSAGES, AiError } from "@/lib/ai/provider";
import { logAiFailure } from "@/lib/ai/diagnostics";
import { parseJsonObject } from "@/lib/ai/schemas";
import { checkImageUpload, toBase64 } from "@/lib/ai-input/upload";
import { VISION_MAX_TOKENS, VISION_TIMEOUT_MS, VISION_USER, isVisionKind, validateVision, visionSystem } from "@/lib/ai-input/vision";
import { codeOf, failure, guard, isFailure, respond } from "@/lib/ai-input/server";

/**
 * POST multipart: file, kind, consent=1, locale. The picture is read into memory, sent to the AI provider for this one request and
 * dropped. It is not stored, not logged, and the answer is returned for a person to review: nothing is written to the database.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(failure("bad_request"));
  }
  const g = await guard(form, "vision");
  if (isFailure(g)) return respond(g);

  const kind = form.get("kind");
  const file = form.get("file");
  if (!isVisionKind(kind) || !(file instanceof File)) return respond(failure("bad_request"));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImageUpload(bytes, kind === "drawing" || kind === "material_label");
  if (!check.ok) return respond(failure(check.reason));

  const t0 = Date.now();
  try {
    const answer = await g.provider.complete({
      system: visionSystem(kind, g.locale),
      user: VISION_USER,
      attachments: [{ mimeType: check.mimeType, data: toBase64(bytes) }],
      maxTokens: VISION_MAX_TOKENS,
      timeoutMs: VISION_TIMEOUT_MS,
    });
    const parsed = parseJsonObject(answer);
    const result = parsed ? validateVision(kind, parsed) : null;
    if (!result) throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: "answer was not usable" });
    return Response.json({ ok: true, result, model: g.provider.model });
  } catch (e) {
    logAiFailure({ op: "vision", provider: g.provider.name, model: g.provider.model, ms: Date.now() - t0 }, e);
    return respond(failure(codeOf(e)));
  }
}

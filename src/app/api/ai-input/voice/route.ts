import { AI_ERROR_MESSAGES, AiError } from "@/lib/ai/provider";
import { logAiFailure } from "@/lib/ai/diagnostics";
import { parseJsonObject } from "@/lib/ai/schemas";
import { checkAudioUpload, toBase64 } from "@/lib/ai-input/upload";
import { VOICE_AUDIO_USER, VOICE_MAX_TOKENS, VOICE_TIMEOUT_MS, isVoiceTarget, validateVoice, voiceSystem, voiceTextSystem, voiceTextUser } from "@/lib/ai-input/voice";
import { codeOf, failure, guard, isFailure, respond } from "@/lib/ai-input/server";

/**
 * POST multipart. Either `audio` (a short WAV clip made in the browser) or `text` (an edited transcript to extract fields from),
 * plus target, consent=1 and locale. Audio is sent to the AI provider for this one request and dropped: not stored, not logged.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(failure("bad_request"));
  }
  const g = await guard(form, "voice");
  if (isFailure(g)) return respond(g);

  const target = form.get("target");
  if (!isVoiceTarget(target)) return respond(failure("bad_request"));
  const audio = form.get("audio");
  const text = form.get("text");

  let system: string;
  let user: string;
  let attachments: { mimeType: string; data: string }[] | undefined;
  if (audio instanceof File) {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const check = checkAudioUpload(bytes);
    if (!check.ok) return respond(failure(check.reason));
    system = voiceSystem(target, g.locale);
    user = VOICE_AUDIO_USER;
    attachments = [{ mimeType: check.mimeType, data: toBase64(bytes) }];
  } else if (typeof text === "string" && text.trim().length >= 2 && text.length <= 4000) {
    system = voiceTextSystem(target);
    user = voiceTextUser(text);
  } else {
    return respond(failure("bad_request"));
  }

  const t0 = Date.now();
  try {
    const answer = await g.provider.complete({ system, user, attachments, maxTokens: VOICE_MAX_TOKENS, timeoutMs: VOICE_TIMEOUT_MS });
    const parsed = parseJsonObject(answer);
    const result = parsed ? validateVoice(target, parsed) : null;
    if (!result) {
      // Silence or noise comes back as an empty transcript: tell the person to try again rather than showing nothing.
      throw new AiError("bad_output", AI_ERROR_MESSAGES.bad_output, { note: "no usable transcript" });
    }
    return Response.json({ ok: true, result, model: g.provider.model });
  } catch (e) {
    logAiFailure({ op: "voice", provider: g.provider.name, model: g.provider.model, ms: Date.now() - t0 }, e);
    return respond(failure(codeOf(e)));
  }
}

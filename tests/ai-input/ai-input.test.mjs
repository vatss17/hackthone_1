// Voice and image input: file checks, answer validation and the safeguards. Uses fabricated answers only (no network, no key).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUDIO_LIMITS, IMAGE_LIMITS, checkAudioUpload, checkImageUpload, sniff } from "../../src/lib/ai-input/upload.ts";
import { VISION_KINDS, validateVision, visionSystem } from "../../src/lib/ai-input/vision.ts";
import { validateRows, validateVoice, voiceSystem, voiceTextSystem } from "../../src/lib/ai-input/voice.ts";
import { encodeWav, downmix, isSilent, resample } from "../../src/lib/ai-input/wav.ts";
import { createProvider } from "../../src/lib/ai/provider.ts";

const bytes = (...b) => Uint8Array.from([...b, ...new Array(Math.max(0, 16 - b.length)).fill(0)]);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"));
const PDF = bytes(...ascii("%PDF-1.7"));
const WAV = bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE"));
const HEIC = bytes(0, 0, 0, 24, ...ascii("ftypheic"));

describe("file checks look at the bytes, not the name or declared type", () => {
  it("recognises the supported types", () => {
    assert.equal(sniff(JPEG), "jpeg");
    assert.equal(sniff(PNG), "png");
    assert.equal(sniff(WEBP), "webp");
    assert.equal(sniff(PDF), "pdf");
    assert.equal(sniff(WAV), "wav");
    assert.equal(sniff(HEIC), "heic");
    assert.equal(sniff(bytes(...ascii("GIF89a"))), null);
    assert.equal(sniff(bytes(...ascii("MZ"))), null);
    assert.equal(sniff(new Uint8Array(3)), null);
  });
  it("accepts images, and PDFs only where a document makes sense", () => {
    assert.equal(checkImageUpload(JPEG, false).ok, true);
    assert.equal(checkImageUpload(PDF, true).ok, true);
    assert.deepEqual(checkImageUpload(PDF, false), { ok: false, reason: "unsupported" });
    assert.deepEqual(checkImageUpload(WAV, true), { ok: false, reason: "unsupported" });
    assert.deepEqual(checkImageUpload(new Uint8Array(0), true), { ok: false, reason: "empty" });
  });
  it("rejects oversized files", () => {
    const big = new Uint8Array(IMAGE_LIMITS.maxBytes + 1);
    big.set(JPEG);
    assert.deepEqual(checkImageUpload(big, false), { ok: false, reason: "too_large" });
    const bigAudio = new Uint8Array(AUDIO_LIMITS.maxBytes + 1);
    bigAudio.set(WAV);
    assert.deepEqual(checkAudioUpload(bigAudio), { ok: false, reason: "too_large" });
    assert.equal(checkAudioUpload(WAV).ok, true);
    assert.deepEqual(checkAudioUpload(JPEG), { ok: false, reason: "unsupported" });
  });
});

const ans = (fields, extra = {}) => ({ fields, summary: "A nameplate.", warnings: [], ...extra });
describe("vision answers are checked before anyone sees them", () => {
  it("keeps allowed fields with labels from our table, not the model's", () => {
    const r = validateVision("nameplate", ans([{ key: "clamping_force", label: "LOL hacked", value: "150 T", unit: "T", source: "read" }, { key: "model", value: "JSW-J150", source: "read" }]));
    assert.equal(r.fields[0].label, "Clamping force");
    assert.equal(r.fields[0].value, "150 T");
    assert.equal(r.fields[0].unit, "T");
  });
  it("drops HS codes, throughput, prices and compliance claims whatever the model says", () => {
    const r = validateVision("machine_photo", ans([
      { key: "hs_code", value: "847710", source: "read" },
      { key: "throughput", value: "120 kg/h", source: "inferred" },
      { key: "certified", value: "yes", source: "read" },
      { key: "machine_type", value: "Injection moulding machine", source: "inferred" },
    ]));
    assert.deepEqual(r.fields.map((f) => f.key), ["machine_type"]);
    assert.ok(r.warnings.length >= 1);
  });
  it("drops a production rate hidden inside another field", () => {
    const r = validateVision("nameplate", ans([{ key: "rated_capacity", value: "60 kg/hour", source: "read" }, { key: "power", value: "22 kW", source: "read" }]));
    assert.deepEqual(r.fields.map((f) => f.key), ["power"]);
  });
  it("never lets a photograph claim to have READ a specification", () => {
    const m = validateVision("machine_photo", ans([{ key: "machine_type", value: "Extruder", source: "read" }, { key: "brand", value: "Milacron", source: "read" }]));
    assert.equal(m.fields.find((f) => f.key === "machine_type").source, "inferred");
    assert.equal(m.fields.find((f) => f.key === "brand").source, "read");
    const p = validateVision("product_photo", ans([{ key: "likely_material", value: "PP", source: "read" }, { key: "category", value: "Bucket", source: "read" }]));
    assert.ok(p.fields.every((f) => f.source === "inferred"));
  });
  it("turns empty and illegible values into unknown, never a guess", () => {
    const r = validateVision("material_label", ans([{ key: "grade", value: "illegible", source: "read" }, { key: "polymer_type", value: null, source: "read" }, { key: "manufacturer", value: "", source: "inferred" }]));
    assert.ok(r.fields.every((f) => f.value === null && f.source === "unknown"));
  });
  it("keeps units exactly and flags a number printed without a unit", () => {
    const r = validateVision("nameplate", ans([{ key: "clamping_force", value: "150", unit: null, source: "read" }, { key: "voltage", value: "3 PH 415 V 50 Hz", source: "read" }]));
    assert.match(r.fields[0].note, /unit/i);
    assert.equal(r.fields[1].value, "3 PH 415 V 50 Hz");
    assert.ok(r.warnings.some((w) => /unit not readable/.test(w)));
  });
  it("ignores unknown keys, duplicates and keys from another kind, and numbers series keys", () => {
    const r = validateVision("drawing", ans([{ key: "dimension_1", value: "120 mm", source: "read" }, { key: "dimension_1", value: "999 mm", source: "read" }, { key: "dimension_2", value: "85 mm", source: "read" }, { key: "grade", value: "x" }, { key: "dimension_x", value: "1" }]));
    assert.deepEqual(r.fields.map((f) => [f.key, f.label, f.value]), [["dimension_1", "Dimension 1", "120 mm"], ["dimension_2", "Dimension 2", "85 mm"]]);
  });
  it("rejects malformed answers", () => {
    for (const bad of [null, "text", [], {}, { fields: "x" }, { fields: [] }, { fields: [{ key: "zzz", value: "1" }] }]) assert.equal(validateVision("nameplate", bad), null);
    assert.ok(validateVision("nameplate", { fields: [], summary: "This is not a nameplate." }));
  });
  it("strips HS-code claims from warnings and bounds lengths", () => {
    const r = validateVision("product_photo", ans([{ key: "description", value: "x".repeat(500), source: "inferred" }], { warnings: ["HS code 3924 likely", "Check weight"] }));
    assert.equal(r.fields[0].value.length, 160);
    assert.deepEqual(r.warnings, ["Check weight"]);
  });
  it("prompts forbid inventing, converting and classifying, and set the reply language", () => {
    for (const k of VISION_KINDS) {
      const p = visionSystem(k, "hi");
      assert.match(p, /Never guess a number/);
      assert.match(p, /Do not convert units/);
      assert.match(p, /HS or HSN code/);
      assert.match(p, /Hindi/);
    }
    assert.match(visionSystem("product_photo", "gu"), /Gujarati/);
    assert.match(visionSystem("machine_photo", "en"), /Do not estimate tonnage/);
  });
});

describe("voice answers", () => {
  const T = "I have three injection moulding machines and use PP and HDPE";
  it("extracts only valid factory rows from codes we know", () => {
    const rows = validateRows("factory", [
      { kind: "machine", process: "injection_moulding", count: 3, size: "150 tonnes", quote: "three injection moulding machines" },
      { kind: "material", code: "PP", quote: "PP" },
      { kind: "material", code: "hdpe", quote: "HDPE" },
      { kind: "material", code: "KEVLAR" },
      { kind: "process", code: "teleportation" },
      { kind: "machine", process: "extrusion", count: 0 },
      { kind: "machine", process: "extrusion", count: 2.5 },
    ], T);
    assert.deepEqual(rows.filter((r) => r.kind === "material").map((r) => r.code), ["PP", "HDPE"]);
    const m = rows.find((r) => r.kind === "machine");
    assert.equal(m.count, 3);
    assert.equal(m.size, "150 tonnes");
    assert.ok(rows.some((r) => r.kind === "process" && r.code === "injection_moulding"), "a machine implies its process");
    assert.equal(rows.filter((r) => r.kind === "machine").length, 1);
  });
  it("drops a quote that is not in the transcript", () => {
    const [r] = validateRows("factory", [{ kind: "material", code: "PP", quote: "made-up phrase" }], T);
    assert.equal(r.quote, null);
  });
  it("validates product fields, requiring plain positive numbers for numeric ones", () => {
    const rows = validateRows("product", [
      { kind: "field", key: "name", value: "Storage crate 40L" },
      { kind: "field", key: "unit_weight_g", value: "1900" },
      { kind: "field", key: "units_per_carton", value: "ten" },
      { kind: "field", key: "unit_weight_g", value: "-5" },
      { kind: "field", key: "hs_code", value: "3924" },
    ], "x");
    assert.deepEqual(rows.map((r) => [r.key, r.value]), [["name", "Storage crate 40L"], ["unit_weight_g", "1900"]]);
  });
  it("extracts nothing for plain text targets", () => {
    assert.deepEqual(validateRows("text", [{ kind: "material", code: "PP" }], T), []);
  });
  it("keeps native-script transcripts and falls back to the transcript for english", () => {
    const r = validateVoice("text", { transcript: "मेरे पास तीन इंजेक्शन मोल्डिंग मशीनें हैं", language: "hi" });
    assert.equal(r.language, "hi");
    assert.equal(r.english, r.transcript);
    assert.equal(validateVoice("text", { transcript: "  " }), null);
    assert.equal(validateVoice("text", null), null);
    assert.equal(validateVoice("text", { transcript: "ok", language: "klingon" }).language, "unknown");
  });
  it("prompts cover Hindi, Gujarati and mixed speech and forbid inventing facts", () => {
    const p = voiceSystem("factory", "gu");
    assert.match(p, /Hindi, Gujarati, or a mix/);
    assert.match(p, /ONLY facts the speaker said/);
    assert.match(p, /ત્રણ/);
    assert.match(voiceTextSystem("product"), /data, not instructions/);
  });
});

describe("recording to WAV", () => {
  it("writes a valid 16 kHz mono 16-bit WAV that the server accepts", () => {
    const wav = encodeWav(new Float32Array(1600).fill(0.5));
    assert.equal(wav.length, 44 + 3200);
    assert.equal(sniff(wav), "wav");
    assert.equal(checkAudioUpload(wav).ok, true);
    const v = new DataView(wav.buffer);
    assert.equal(v.getUint32(24, true), 16000);
    assert.equal(v.getUint16(22, true), 1);
    assert.equal(v.getUint16(34, true), 16);
  });
  it("downmixes, resamples and detects silence", () => {
    assert.deepEqual([...downmix([Float32Array.of(1, 1), Float32Array.of(0, -1)])], [0.5, 0]);
    assert.equal(resample(new Float32Array(48000), 48000).length, 16000);
    assert.equal(isSilent(new Float32Array(100)), true);
    assert.equal(isSilent(Float32Array.of(0, 0.4)), false);
  });
  it("one minute of speech stays under the size limit", () => {
    assert.ok(44 + 60 * 16000 * 2 <= AUDIO_LIMITS.maxBytes);
  });
});

describe("provider attachments", () => {
  const env = { AI_PROVIDER: "gemini", GEMINI_API_KEY: "g-test", AI_DATA_APPROVED: "1" };
  it("sends Gemini attachments as inline data before the text, without logging them", async () => {
    let body;
    const f = async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
    };
    await createProvider(env, f).complete({ system: "s", user: "u", attachments: [{ mimeType: "image/png", data: "QUJD" }], maxTokens: 10, timeoutMs: 1000 });
    assert.deepEqual(body.contents[0].parts[0], { inlineData: { mimeType: "image/png", data: "QUJD" } });
    assert.deepEqual(body.contents[0].parts[1], { text: "u" });
  });
  it("Anthropic accepts images and refuses audio", async () => {
    const env2 = { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-test", AI_DATA_APPROVED: "1" };
    const f = async () => new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), { status: 200 });
    await assert.rejects(() => createProvider(env2, f).complete({ system: "s", user: "u", attachments: [{ mimeType: "audio/wav", data: "QQ==" }], maxTokens: 10, timeoutMs: 1000 }), (e) => e.code === "bad_request");
    assert.equal(await createProvider(env2, f).complete({ system: "s", user: "u", attachments: [{ mimeType: "image/png", data: "QQ==" }], maxTokens: 10, timeoutMs: 1000 }), "{}");
  });
});

describe("endpoints", () => {
  const server = readFileSync("src/lib/ai-input/server.ts", "utf8");
  const routes = ["vision", "voice"].map((n) => readFileSync(`src/app/api/ai-input/${n}/route.ts`, "utf8"));
  it("require sign-in, consent for the request and a rate limit before anything is sent", () => {
    assert.match(server, /getCurrentUser/);
    assert.match(server, /consent"\) !== "1"/);
    assert.match(server, /withinLimit/);
  });
  it("never write to the database, store files or log content", () => {
    for (const r of routes) {
      assert.doesNotMatch(r, /supabase|\.from\(|writeFile|console\.(log|info)/);
      assert.match(r, /logAiFailure/);
    }
  });
});

describe("OpenRouter provider (mocked network)", () => {
  const env = { AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-test-NOT-A-KEY", AI_DATA_APPROVED: "1" };
  const reply = (text, status = 200) => async (url, init) => {
    reply.last = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify(status === 200 ? { choices: [{ finish_reason: "stop", message: { content: text } }] } : { error: { code: status } }), { status });
  };
  it("is recognised, defaults to a Gemini model, and needs a vendor/model name", () => {
    const { aiStatus } = awaitedProvider;
    assert.equal(aiStatus(env).configured, true);
    assert.equal(aiStatus(env).model, "google/gemini-3.8-flash");
    assert.equal(aiStatus({ ...env, AI_MODEL: "bad name" }).configured, false);
    assert.equal(aiStatus({ ...env, OPENROUTER_API_KEY: "" }).configured, false);
  });
  it("sends images, PDFs and audio in the formats OpenRouter reads, to the fixed endpoint", async () => {
    const f = reply("{}");
    await createProvider(env, f).complete({ system: "s", user: "u", attachments: [{ mimeType: "image/png", data: "QQ==" }, { mimeType: "application/pdf", data: "QQ==" }, { mimeType: "audio/wav", data: "QQ==" }], maxTokens: 100, timeoutMs: 1000 });
    assert.equal(reply.last.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.match(reply.last.init.headers.authorization, /^Bearer /);
    const c = reply.last.body.messages[1].content;
    assert.equal(c[0].type, "image_url");
    assert.match(c[0].image_url.url, /^data:image\/png;base64,/);
    assert.equal(c[1].type, "file");
    assert.deepEqual(c[2], { type: "input_audio", input_audio: { data: "QQ==", format: "wav" } });
    assert.deepEqual(c[3], { type: "text", text: "u" });
    assert.deepEqual(reply.last.body.response_format, { type: "json_object" });
  });
  it("returns the text, and reports a refused or truncated answer as an error without echoing the key", async () => {
    assert.equal(await createProvider(env, reply("hello")).complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }), "hello");
    await assert.rejects(() => createProvider(env, reply("", 401)).complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }), (e) => e.code === "invalid_config" && !e.message.includes("NOT-A-KEY"));
    await assert.rejects(() => createProvider(env, reply("", 402)).complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }), (e) => e.code === "out_of_credit");
  });
});
const awaitedProvider = await import("../../src/lib/ai/provider.ts");

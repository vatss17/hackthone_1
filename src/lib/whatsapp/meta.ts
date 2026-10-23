import { createHmac, timingSafeEqual } from "node:crypto";

/** Meta signs every webhook with the app secret: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const want = createHmac("sha256", appSecret).update(rawBody).digest();
  let got: Buffer;
  try {
    got = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return got.length === want.length && timingSafeEqual(got, want);
}

export type Inbound = { id: string; from: string; text: string | null; kind: string };

/** The messages in a webhook payload. Delivery/read receipts and anything else are ignored. */
export function parseInbound(payload: unknown): Inbound[] {
  const out: Inbound[] = [];
  const p = payload as { entry?: { changes?: { value?: { messages?: Record<string, unknown>[] } }[] }[] };
  for (const e of p?.entry ?? []) for (const c of e?.changes ?? []) for (const m of c?.value?.messages ?? []) {
    const id = typeof m.id === "string" ? m.id : "";
    const from = typeof m.from === "string" ? m.from : "";
    if (!id || !from) continue;
    const kind = typeof m.type === "string" ? m.type : "unknown";
    const text =
      kind === "text" ? ((m.text as { body?: string })?.body ?? null)
      : kind === "button" ? ((m.button as { text?: string })?.text ?? null)
      : kind === "interactive" ? (((m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } })?.button_reply?.title) ?? ((m.interactive as { list_reply?: { title?: string } })?.list_reply?.title) ?? null)
      : null;
    out.push({ id, from, text, kind });
  }
  return out;
}

export async function sendText(cfg: { phoneNumberId: string; accessToken: string }, to: string, body: string, fetcher: typeof fetch = fetch): Promise<void> {
  const r = await fetcher(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: body.slice(0, 4000) } }),
  });
  if (!r.ok) throw new Error(`whatsapp send ${r.status}`);
}

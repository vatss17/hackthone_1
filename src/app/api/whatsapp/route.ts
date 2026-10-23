import { NextResponse } from "next/server";
import { parseInbound, sendText, verifySignature } from "@/lib/whatsapp/meta";
import { handleInbound } from "@/lib/whatsapp/handle";
import { storeFromEnv } from "@/lib/whatsapp/session-store";


const config = () => {
  const e = process.env;
  const verifyToken = e.WHATSAPP_VERIFY_TOKEN;
  const appSecret = e.WHATSAPP_APP_SECRET;
  const accessToken = e.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = e.WHATSAPP_PHONE_NUMBER_ID;
  return verifyToken && appSecret && accessToken && phoneNumberId ? { verifyToken, appSecret, accessToken, phoneNumberId } : null;
};

/** Meta's one-time subscription check. */
export async function GET(req: Request) {
  const cfg = config();
  if (!cfg) return new NextResponse("WhatsApp is not configured.", { status: 503 });
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === cfg.verifyToken) return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const cfg = config();
  if (!cfg) return new NextResponse("WhatsApp is not configured.", { status: 503 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) return new NextResponse("Bad signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  const store = storeFromEnv();
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  for (const m of parseInbound(payload)) {
    try {
      for (const body of await handleInbound(m, store, { salt: cfg.appSecret, siteUrl })) await sendText(cfg, m.from, body);
    } catch (err) {
      // Never fail the webhook: Meta would retry the whole batch. Log only the kind of failure, never the message or number.
      console.error("whatsapp: could not handle a message", err instanceof Error ? err.message : "unknown");
    }
  }
  return new NextResponse("ok", { status: 200 });
}

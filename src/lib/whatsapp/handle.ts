import { step } from "./bot.ts";
import { sessionKey, type SessionStore } from "./session-store.ts";
import type { Inbound } from "./meta.ts";

/** One inbound message -> the replies to send. Duplicates (webhook retries) return nothing. */
export async function handleInbound(m: Inbound, store: SessionStore, cfg: { salt: string; siteUrl: string }): Promise<string[]> {
  if (!(await store.firstSeen(m.id))) return [];
  if (m.text === null) return ["I can only read text messages for now. Please type your answer."];
  const key = sessionKey(m.from, cfg.salt);
  const { state, replies } = step(await store.get(key), m.text, { siteUrl: cfg.siteUrl });
  await store.set(key, state);
  return replies;
}

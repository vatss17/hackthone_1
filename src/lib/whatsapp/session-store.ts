import { createHash } from "node:crypto";
import type { BotState } from "./bot.ts";

/** Where a conversation's answers are remembered between messages. Keyed by a hash of the phone number, never the number itself. */
export interface SessionStore {
  get(key: string): Promise<BotState | null>;
  set(key: string, state: BotState | null): Promise<void>;
  /** True the first time an id is seen, false after (Meta redelivers webhooks). */
  firstSeen(id: string): Promise<boolean>;
}

export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const sessionKey = (phone: string, salt: string) => "wa:s:" + createHash("sha256").update(`${salt}:${phone}`).digest("hex").slice(0, 32);

export class MemoryStore implements SessionStore {
  private s = new Map<string, { v: BotState; exp: number }>();
  private ids = new Map<string, number>();
  async get(key: string) {
    const e = this.s.get(key);
    return e && e.exp > Date.now() ? e.v : null;
  }
  async set(key: string, state: BotState | null) {
    if (state) this.s.set(key, { v: state, exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
    else this.s.delete(key);
  }
  async firstSeen(id: string) {
    const e = this.ids.get(id);
    if (e && e > Date.now()) return false;
    this.ids.set(id, Date.now() + SESSION_TTL_SECONDS * 1000);
    return true;
  }
}

/** Upstash Redis (or Vercel KV) through its REST API: no dependency, two environment variables. */
export class RestRedisStore implements SessionStore {
  private url: string;
  private token: string;
  private fetcher: typeof fetch;
  constructor(url: string, token: string, fetcher: typeof fetch = fetch) {
    this.url = url;
    this.token = token;
    this.fetcher = fetcher;
  }
  private async cmd(...args: (string | number)[]): Promise<unknown> {
    const r = await this.fetcher(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return ((await r.json()) as { result: unknown }).result;
  }
  async get(key: string) {
    const v = await this.cmd("GET", key);
    return typeof v === "string" ? (JSON.parse(v) as BotState) : null;
  }
  async set(key: string, state: BotState | null) {
    if (state) await this.cmd("SET", key, JSON.stringify(state), "EX", SESSION_TTL_SECONDS);
    else await this.cmd("DEL", key);
  }
  async firstSeen(id: string) {
    return (await this.cmd("SET", "wa:m:" + id, "1", "EX", SESSION_TTL_SECONDS, "NX")) === "OK";
  }
}

let memory: MemoryStore | null = null;
export function storeFromEnv(env: Record<string, string | undefined> = process.env): SessionStore {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) return new RestRedisStore(url, token);
  // Memory only survives while one server instance stays warm: fine for local tests, not for a live deployment.
  return (memory ??= new MemoryStore());
}

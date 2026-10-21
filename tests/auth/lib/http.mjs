// Minimal browser-like HTTP client for the auth end-to-end tests: cookie jar plus
// progressive-enhancement form submission (what a browser does with JavaScript off).
// Never logs cookies, passwords or tokens.

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export class Browser {
  jar = new Map();
  lastSetCookies = [];

  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasAuthCookie() {
    return [...this.jar.keys()].some((k) => k.startsWith("sb-"));
  }
  /** Replace the jar with a snapshot (to replay an old session). */
  restore(snapshot) {
    this.jar = new Map(snapshot);
  }
  snapshot() {
    return new Map(this.jar);
  }

  async request(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${APP_URL}${path}`, {
      method,
      body,
      redirect: "manual",
      headers: { Cookie: this.cookieHeader(), Origin: APP_URL, Referer: `${APP_URL}${path}`, ...headers },
    });
    this.lastSetCookies = res.headers.getSetCookie();
    for (const line of this.lastSetCookies) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /^\s*max-age=0/i.test(a)) || attrs.some((a) => /^\s*expires=.*1970/i.test(a));
      if (expired || value === "") this.jar.delete(name);
      else this.jar.set(name, value);
    }
    const text = await res.text();
    return { status: res.status, location: res.headers.get("location"), text, setCookies: this.lastSetCookies };
  }

  get(path) {
    return this.request(path);
  }

  /** GET and follow HTTP redirects and streamed <meta refresh> redirects (like a browser). */
  async browse(path, maxHops = 8) {
    const trail = [];
    let next = path;
    for (let i = 0; i < maxHops; i++) {
      const r = await this.get(next);
      trail.push({ path: next, status: r.status });
      const meta = r.text.match(/<meta[^>]*http-equiv="refresh"[^>]*content="\d+;url=([^"]+)"/i)?.[1];
      const target = r.location ?? (meta ? decode(meta) : null);
      if (!target) return { ...r, finalPath: next, trail, looped: false };
      const url = new URL(target, APP_URL);
      next = url.pathname + url.search;
    }
    return { status: 0, text: "", finalPath: next, trail, looped: true };
  }

  /** Hidden inputs (the Server Action identifiers) of the first form on `path` containing `marker`. */
  async hiddenFields(path, marker) {
    const page = await this.get(path);
    const form = [...page.text.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(marker));
    if (!form) throw new Error(`no form containing ${marker} on ${path} (status ${page.status})`);
    return [...form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)]
      .map((m) => [m[0].match(/name="([^"]*)"/)?.[1], m[0].match(/value="([^"]*)"/)?.[1] ?? ""])
      .filter(([n]) => n)
      .map(([n, v]) => [decode(n), decode(v)]);
  }

  /** POST a form using previously harvested hidden fields plus `fields`, as THIS session. */
  postForm(path, hidden, fields) {
    const data = new FormData();
    for (const [k, v] of hidden) data.append(k, v);
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return this.request(path, { method: "POST", body: data });
  }

  /** Submit the first <form> on `path` whose HTML includes `marker`, with `fields` filled in. */
  async submit(path, marker, fields) {
    const page = await this.get(path);
    const forms = [...page.text.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
    const form = forms.find((f) => f.includes(marker));
    if (!form) throw new Error(`no form containing ${marker} on ${path} (status ${page.status})`);
    const data = new FormData();
    for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = m[0].match(/name="([^"]*)"/)?.[1];
      const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
      if (name) data.append(decode(name), decode(value));
    }
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return this.request(path, { method: "POST", body: data });
  }
}

export async function appIsUp() {
  try {
    const r = await fetch(`${APP_URL}/login`, { redirect: "manual" });
    return r.status === 200;
  } catch {
    return false;
  }
}

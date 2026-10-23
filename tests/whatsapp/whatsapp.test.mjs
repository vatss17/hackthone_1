import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { step } from "../../src/lib/whatsapp/bot.ts";
import { handleInbound } from "../../src/lib/whatsapp/handle.ts";
import { MemoryStore, RestRedisStore, sessionKey } from "../../src/lib/whatsapp/session-store.ts";
import { parseInbound, verifySignature } from "../../src/lib/whatsapp/meta.ts";

const opts = { siteUrl: "https://example.test" };
const say = (s, t) => step(s, t, opts);

describe("conversation", () => {
  it("greets, then asks the four questions one at a time and ends with fit results and a link", () => {
    let r = say(null, "hi");
    assert.equal(r.state.stage, "asking");
    assert.match(r.replies.join("\n"), /What does your factory make/);
    r = say(r.state, "1");
    assert.match(r.replies[0], /Got it: .*[Ii]njection/);
    assert.match(r.replies.join("\n"), /Question 2 of 4/);
    r = say(r.state, "PP and HDPE");
    assert.match(r.replies[0], /PP, HDPE/);
    r = say(r.state, "3 injection moulding machines, 150 tonnes");
    assert.match(r.replies[0], /3 injection moulding machines of 150 tonnes/);
    r = say(r.state, "storage crates, buckets");
    assert.equal(r.state.stage, "done");
    const all = r.replies.join("\n");
    assert.match(all, /What you make today/);
    assert.match(all, /not market demand/);
    assert.match(all, /https:\/\/example\.test\/signup/);
  });
  it("does not move on when nothing was understood, and lets later questions be skipped", () => {
    let r = say(null, "hello");
    r = say(r.state, "asdf qwer");
    assert.equal(r.state.q, "make");
    assert.match(r.replies[0], /did not find anything new/);
    r = say(r.state, "We make bottles by blow moulding");
    r = say(r.state, "skip");
    assert.equal(r.state.q, "machines");
    r = say(r.state, "skip");
    r = say(r.state, "skip");
    assert.equal(r.state.stage, "done");
    assert.match(r.replies.join("\n"), /Still missing/);
  });
  it("understands Hindi and Gujarati words, restarts on request and forgets on request", () => {
    let r = say(null, "hi");
    r = say(r.state, "hum injection moulding karte hain");
    assert.ok(r.state.factory.processes.includes("injection_moulding"));
    r = say(r.state, "restart");
    assert.deepEqual(r.state.factory.processes, []);
    r = say(r.state, "stop");
    assert.equal(r.state, null);
    assert.match(r.replies[0], /deleted everything/);
  });
});

describe("webhook plumbing", () => {
  const secret = "s3cret";
  const sign = (b) => "sha256=" + createHmac("sha256", secret).update(b).digest("hex");
  it("accepts only a correct signature", () => {
    assert.ok(verifySignature("{}", sign("{}"), secret));
    assert.ok(!verifySignature("{}", sign("{ }"), secret));
    assert.ok(!verifySignature("{}", null, secret));
    assert.ok(!verifySignature("{}", "sha256=zz", secret));
  });
  it("reads text, button and non-text messages and ignores receipts", () => {
    const p = { entry: [{ changes: [{ value: { statuses: [{ id: "x" }], messages: [
      { id: "1", from: "911", type: "text", text: { body: "hi" } },
      { id: "2", from: "911", type: "interactive", interactive: { button_reply: { title: "Yes" } } },
      { id: "3", from: "911", type: "audio" },
    ] } }] }] };
    assert.deepEqual(parseInbound(p).map((m) => [m.id, m.text]), [["1", "hi"], ["2", "Yes"], ["3", null]]);
    assert.deepEqual(parseInbound({}), []);
  });
  it("handles a message once, remembers by hashed number, and answers non-text kindly", async () => {
    const store = new MemoryStore();
    const cfg = { salt: "x", siteUrl: "https://example.test" };
    const m = { id: "a", from: "919800000000", text: "hi", kind: "text" };
    assert.ok((await handleInbound(m, store, cfg)).length > 0);
    assert.deepEqual(await handleInbound(m, store, cfg), []);
    const key = sessionKey(m.from, cfg.salt);
    assert.ok(!key.includes("919800000000"));
    assert.equal((await store.get(key)).stage, "asking");
    assert.match((await handleInbound({ id: "b", from: m.from, text: null, kind: "audio" }, store, cfg))[0], /only read text/);
  });
  it("talks to Redis over REST", async () => {
    const calls = [];
    const f = async (url, init) => { calls.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ result: "OK" }) }; };
    const s = new RestRedisStore("https://r.test", "tok", f);
    await s.set("k", { v: 1, stage: "new", q: "make", factory: {} });
    assert.equal(calls[0][0], "SET"); assert.ok(calls[0].includes("EX"));
    assert.equal(await s.firstSeen("id1"), true);
    assert.ok(calls[1].includes("NX"));
  });
});

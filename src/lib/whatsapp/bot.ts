import {
  QUESTIONS, FACTORY_SCRIPT, englishSay, describeFactoryDelta, describeMissing, fallbackFactoryRows, firstQuestion,
  mergeFactory, nextQuestion, progress, TEMPLATES, type FactoryAnswers, type QuestionId,
} from "../start/chat-flow.ts";
import { factoryInputFromAnswers } from "../start/capability.ts";
import { discover, FIT_LABEL } from "../opportunities/engine.ts";

/**
 * The WhatsApp conversation, as a pure function: (what we remember, what the person typed) -> (what we remember, what to say).
 * It reuses the website's chat setup (same questions, same word matching, same "add, never overwrite" merge) and the same
 * opportunity engine, so the bot and the website can never disagree. No model is called, nothing is saved to the database,
 * and what we remember is only the answers given so far.
 */

export type BotState = {
  v: 1;
  stage: "new" | "asking" | "done";
  q: QuestionId;
  factory: FactoryAnswers;
};

export const newState = (): BotState => ({ v: 1, stage: "new", q: firstQuestion("factory"), factory: { processes: [], materials: [], machines: [], products: [] } });

const SKIP = /^(skip|not sure|i'?m not sure|don'?t know|dont know|no|none|pass|next)$/i;
const GREETING = /^(hi+|hello+|hey+|start|menu|help|namaste|namaskar|नमस्ते|નમસ્તે|restart|reset|start over)$/i;
const DELETE = /^(stop|delete|delete my data|forget me)$/i;

const askText = (q: QuestionId): string => {
  const question = QUESTIONS[q];
  const sends = question.chips.filter((c) => c.kind === "send");
  const toggles = question.chips.filter((c) => c.kind === "toggle");
  const lines = [question.text];
  if (sends.length) lines.push("", ...sends.map((c, i) => `${i + 1}. ${c.label}`), "", "Reply with a number or type it in your own words.");
  else if (toggles.length) lines.push(`Options: ${toggles.map((c) => c.label).join(", ")}. List the ones you use, or reply "skip".`);
  else lines.push(`${question.placeholder}. Or reply "skip".`);
  return lines.join("\n");
};

const WELCOME = [
  "Hi, I'm Atlas, your export assistant. I help Indian plastics manufacturers see what they could export to the UAE.",
  "I will ask a few short questions, one at a time. You can answer in your own words (English, Hindi or Gujarati words both work), reply \"skip\" to pass a question, or \"restart\" any time.",
].join("\n\n");

function summary(a: FactoryAnswers, siteUrl: string): string[] {
  const out: string[] = [];
  const d = discover(factoryInputFromAnswers(a));
  const made = d.yourProducts.filter((p) => p.entry && p.match);
  const lines: string[] = ["Thank you. Here is what I found from what you told me:"];
  if (made.length) {
    lines.push("", "What you make today:");
    for (const p of made) lines.push(`• ${p.entry!.name}: ${FIT_LABEL[p.match!.level]}`);
  }
  const top = d.adjacent.slice(0, 3);
  if (top.length) {
    lines.push("", "Other products your machines could support:");
    for (const m of top) lines.push(`• ${m.entry.name}: ${FIT_LABEL[m.level]}`);
  } else if (d.profileTooThin) lines.push("", "I need at least one process (like injection moulding) before I can suggest products.");
  out.push(lines.join("\n"));
  const missing = describeMissing("factory", a, { name: "", desc: "", material: "", use: "", weight: "", size: "" }, englishSay.t);
  out.push([
    missing ?? "",
    "This fit comes from your declared machines and processes. It is not market demand, and I have not checked costs or rules yet.",
    `To see the economics, requirements and documents for the UAE, continue on the website: ${siteUrl}/signup`,
    "Reply \"restart\" to try another factory.",
  ].filter(Boolean).join("\n\n"));
  return out;
}

export function step(state: BotState | null, input: string, opts: { siteUrl: string }): { state: BotState | null; replies: string[] } {
  const text = input.trim().slice(0, 1000);
  const cur: BotState = state && state.v === 1 ? state : newState();
  if (DELETE.test(text)) return { state: null, replies: ["Done. I have deleted everything I remembered from this chat. Send \"hi\" to start again."] };

  if (cur.stage === "new" || GREETING.test(text)) {
    const fresh = newState();
    fresh.stage = "asking";
    return { state: fresh, replies: [WELCOME, askText(fresh.q)] };
  }
  if (cur.stage === "done") {
    return { state: cur, replies: [`Your result is above. Continue on the website: ${opts.siteUrl}/signup\n\nReply "restart" to try another factory, or "stop" to delete this chat.`] };
  }
  if (!text) return { state: cur, replies: [askText(cur.q)] };

  const question = QUESTIONS[cur.q];
  const sends = question.chips.filter((c) => c.kind === "send");
  let answer = text;
  if (/^\d$/.test(text) && sends[Number(text) - 1]) answer = sends[Number(text) - 1].value;

  const replies: string[] = [];
  let factory = cur.factory;
  if (SKIP.test(answer) && cur.q !== "make") {
    // skipped on purpose: move on without reading anything
  } else {
    const { next, delta } = mergeFactory(factory, fallbackFactoryRows(cur.q, answer, factory));
    const said = describeFactoryDelta(delta, englishSay);
    if (!said) {
      return { state: cur, replies: [TEMPLATES.nothingNew.replace("or skip this question", cur.q === "make" ? "or reply \"restart\"" : "or reply \"skip\""), askText(cur.q)] };
    }
    factory = next;
    replies.push(said);
  }

  const nq = nextQuestion("factory", cur.q);
  if (!nq || !FACTORY_SCRIPT.includes(nq)) {
    return { state: { ...cur, stage: "done", factory }, replies: [...replies, ...summary(factory, opts.siteUrl)] };
  }
  const p = progress("factory", nq);
  return { state: { ...cur, q: nq, factory }, replies: [...replies, `Question ${p.n} of ${p.total}\n\n${askText(nq)}`] };
}

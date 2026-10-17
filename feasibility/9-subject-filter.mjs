// Stage 5, step 4: Saket's subject filter. Could we skip some emails' full AI read
// by looking at the sender + subject only? Tested on the 75 IIM/placement emails of
// the test set (marketing senders are already skipped by the noise filter).
//   1. Free rules (no AI): the placement portal's "Application Submitted" receipts.
//   2. A quick AI look at sender + subject + attachment names: "skip" only when
//      certain there's nothing to act on; anything unsure gets the full read.
// Passes only if it skips ZERO emails that hold a real item.
//   node --env-file=../.env.local 9-subject-filter.mjs
// Prints counts; the per-email report stays in secrets/testset/ (not in Git).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "secrets", "testset");
const items = JSON.parse(fs.readFileSync(path.join(DIR, "items.json"), "utf8"));
const labels = JSON.parse(fs.readFileSync(path.join(DIR, "labels.json"), "utf8"));
const MODEL = "openai/gpt-oss-120b";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const address = (from) => (from ?? "").replace(/.*</, "").replace(">", "").trim().toLowerCase();

const FREE_RULES = [
  { name: "portal application receipt", test: (m) => address(m.from).endsWith("@edtex.in") && /^application submitted\b/i.test(m.subject) },
];

const PROMPT = `You help a student's deadline tracker decide which emails need a full read.
You see only an email's sender, subject and attachment names, never its text.
Answer "skip" ONLY if you are certain the email holds nothing the student might
need to do, attend, submit, register for, or note by a date: e.g. festival
greetings, photo albums, press clippings, results/winner announcements, receipts
confirming something already done. Club, committee, placement, course, office and
event emails often hide deadlines or events in the text: answer "read" whenever
there is any doubt. Missing a real deadline is far worse than an extra read.
Reply as JSON: {"decision": "skip" | "read", "reason": "<few words>"}`;

async function quickLook(m) {
  const user = `From: ${m.from ?? ""}\nSubject: ${m.subject || "(no subject)"}\nAttachments: ${(m.attachments ?? []).join(", ") || "none"}`;
  for (;;) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: PROMPT }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        reasoning_effort: "medium",
        temperature: 0,
      }),
    });
    const body = await res.json();
    if (res.status === 429 && !/per day|TPD|RPD/i.test(body.error?.message ?? "")) {
      await sleep((Number(res.headers.get("retry-after")) || 10) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${body.error?.message}`);
    let answer;
    try {
      answer = JSON.parse(body.choices[0].message.content);
    } catch {
      answer = { decision: "read", reason: "unreadable answer" }; // unsure = read
    }
    return { decision: answer.decision === "skip" ? "skip" : "read", reason: answer.reason ?? "", tokens: body.usage?.total_tokens ?? 0 };
  }
}

const emails = items.map((m, i) => ({ ...m, n: i + 1 })).filter((m) => m.kind === "email" && m.group !== "other_sender");
const t = { emails: emails.length, real: 0, nothing: 0, freeSkipped: 0, aiSkipped: 0, realSkipped: 0, tokens: 0 };
const report = [];

for (const m of emails) {
  const isReal = (labels[m.id]?.items ?? []).length > 0;
  isReal ? t.real++ : t.nothing++;
  const rule = FREE_RULES.find((r) => r.test(m));
  let decision, reason;
  if (rule) (decision = "skip"), (reason = `free rule: ${rule.name}`), t.freeSkipped++;
  else {
    const a = await quickLook(m);
    (decision = a.decision), (reason = a.reason), (t.tokens += a.tokens);
    if (decision === "skip") t.aiSkipped++;
  }
  if (decision === "skip" && isReal) t.realSkipped++;
  report.push(`#${m.n} ${decision.toUpperCase()}${decision === "skip" && isReal ? "  <-- HAS A REAL ITEM" : ""} | ${m.subject.slice(0, 70)} | ${reason}`);
  process.stdout.write(".");
}

const skipped = t.freeSkipped + t.aiSkipped;
console.log(`\n${t.emails} emails the AI would read today (${t.real} with real items, ${t.nothing} without)`);
console.log(`Skipped by free rules: ${t.freeSkipped}; by the quick AI look: ${t.aiSkipped}`);
console.log(`Emails with a REAL item skipped: ${t.realSkipped}   <- must be 0`);
console.log(`Full reads saved: ${skipped} of ${t.emails} (${Math.round((100 * skipped) / t.emails)}%)`);
console.log(`Quick-look tokens: ${t.tokens} (${Math.round(t.tokens / Math.max(1, t.emails - t.freeSkipped))} per email)`);
fs.writeFileSync(path.join(DIR, "subject-filter-report.txt"), report.join("\n"));
console.log("Details: secrets/testset/subject-filter-report.txt");

// Stage 5, step 4: run one Groq model over the 100 labelled test items.
//   node 6-run-test.mjs <model> [--limit N]
// Saves answers to secrets/testset/results-<model>.json after every item, so a run
// that hits Groq's daily token cap can simply be re-run the next day to continue.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT, userMessage } from "./extract-prompt.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "secrets", "testset");
const model = process.argv[2];
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
if (!model) throw new Error("Usage: node 6-run-test.mjs <model> [--limit N]");

// The Groq key lives in the website's .env.local (never in code or Git).
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(here, "..", ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const items = JSON.parse(fs.readFileSync(path.join(DIR, "items.json"), "utf8"));
const outFile = path.join(DIR, `results-${model.replace(/[^a-z0-9.-]/gi, "_")}.json`);
const results = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(item) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const started = Date.now();
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage(item) },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "medium",
        temperature: 0,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      let parsed;
      try {
        parsed = JSON.parse(body.choices[0].message.content);
      } catch {
        parsed = { items: [], parse_error: body.choices[0].message.content };
      }
      return { answer: parsed, usage: body.usage, seconds: (Date.now() - started) / 1000 };
    }
    // 429 = slow down (per-minute limit) or out of daily tokens.
    const message = body.error?.message ?? JSON.stringify(body);
    if (res.status === 429 && /per day|TPD|RPD/i.test(message)) return { stop: `Daily limit reached: ${message}` };
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) || 10 * attempt;
      await sleep(wait * 1000);
      continue;
    }
    return { stop: `HTTP ${res.status}: ${message}` };
  }
  return { stop: "Gave up after repeated rate limits" };
}

let done = 0;
for (const item of items) {
  if (results[item.id]) continue;
  if (done >= limit) break;
  const r = await ask(item);
  if (r.stop) {
    console.log(`Stopped: ${r.stop}`);
    break;
  }
  results[item.id] = r;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  done++;
  process.stdout.write(`${Object.keys(results).length}/${items.length} `);
}

const all = Object.values(results);
const tokens = all.reduce((s, r) => s + (r.usage?.total_tokens ?? 0), 0);
console.log(`\n${model}: ${all.length}/${items.length} items answered, ${tokens} tokens used so far.`);

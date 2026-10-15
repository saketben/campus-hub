// Stage 5, step 4: run the app's own AI reader (lib/ai-reader) over the 100 labelled
// test items, with any provider. Run from the project folder:
//   npx tsx --env-file=.env.local --conditions=react-server feasibility/6-run-test.mts <provider> [model] [--tag name] [--limit N]
//   e.g.  ... 6-run-test.mts groq openai/gpt-oss-120b --tag round2
//         ... 6-run-test.mts anthropic claude-haiku-5-5 --tag round2
// Saves to secrets/testset/results-<provider>-<model>-<tag>.json after every item,
// so a run stopped by a daily cap continues where it left off when re-run.
// Score with: node feasibility/7-score.mjs <provider>-<model>-<tag>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMessage, QuotaExhaustedError, RateLimitedError, TooLargeError, BadAnswerError, type MessageToRead } from "../lib/ai-reader";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "secrets", "testset");
const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [provider, modelArg] = positional;
if (!provider) throw new Error("Usage: 6-run-test.mts <provider> [model] [--tag name] [--limit N]");
const tag = flag("--tag") ?? "run";
const limit = Number(flag("--limit") ?? Infinity);

type TestItem = { id: string; kind: "email" | "announcement"; received_at: string; from?: string; course?: string; subject: string; attachments?: string[]; text: string };
const items: TestItem[] = JSON.parse(fs.readFileSync(path.join(DIR, "items.json"), "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Same defaults as lib/ai-reader, so the results file is known before any call.
const model = modelArg ?? (provider === "anthropic" ? "claude-haiku-5-5" : "openai/gpt-oss-120b");
const outFile = path.join(DIR, `results-${`${provider}-${model}-${tag}`.replace(/[^a-z0-9.-]/gi, "_")}.json`);
const results: Record<string, unknown> = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
let done = 0;
let badAnswers = 0;

for (const item of items) {
  if (done >= limit) break;
  if (results[item.id]) continue; // answered in an earlier run
  const message: MessageToRead = {
    kind: item.kind,
    receivedAt: item.received_at,
    from: item.from,
    course: item.course,
    subject: item.subject,
    attachments: item.attachments,
    text: item.text,
  };

  let record: Record<string, unknown> | undefined;
  for (let attempt = 1; !record; attempt++) {
    const started = Date.now();
    try {
      const r = await readMessage(message, { provider, model });
      record = {
        answer: { items: r.items },
        usage: { prompt_tokens: r.inputTokens, completion_tokens: r.outputTokens, total_tokens: r.inputTokens + r.outputTokens },
        seconds: (Date.now() - started) / 1000,
      };
    } catch (e) {
      if (e instanceof RateLimitedError) await sleep(e.retryAfterSeconds * 1000);
      else if (e instanceof QuotaExhaustedError) {
        console.log(`\nStopped (daily allowance or credit used up): ${e.message}`);
        process.exit(0);
      } else if (e instanceof TooLargeError) record = { answer: { items: [], failed: "too large for this plan" }, usage: {}, seconds: 0 };
      else if (e instanceof BadAnswerError) {
        badAnswers++;
        if (attempt >= 3) record = { answer: { items: [], failed: `bad answer 3 times: ${e.message.slice(0, 200)}` }, usage: {}, seconds: 0 };
      } else throw e;
    }
  }
  results[item.id] = record;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  done++;
  process.stdout.write(`${Object.keys(results).length}/${items.length} `);
}

const all = Object.values(results) as { usage?: { total_tokens?: number }; answer?: { failed?: string } }[];
console.log(`\n${provider}: ${all.length}/${items.length} answered, ${all.reduce((s, r) => s + (r.usage?.total_tokens ?? 0), 0)} tokens.`);
console.log(`Bad answers retried: ${badAnswers}; items that failed: ${all.filter((r) => r.answer?.failed).length}`);
console.log(`Results: ${path.relative(path.join(here, ".."), outFile)}`);

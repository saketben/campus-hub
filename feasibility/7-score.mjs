// Stage 5, step 4: score a model's answers against Saket's labels.
//   node 7-score.mjs <run>   e.g. openai/gpt-oss-120b (round 1)
//                                 groq-openai/gpt-oss-120b-round2
//   add --only email|announcement to score one kind of message only.
// Prints totals only. A per-item report (with titles) goes to
// secrets/testset/score-<model>.txt for review; it stays on this laptop.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, "secrets", "testset");
const model = process.argv[2];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const safe = model.replace(/[^a-z0-9.-]/gi, "_") + (only ? `-${only}` : "");
const allItems = JSON.parse(fs.readFileSync(path.join(DIR, "items.json"), "utf8"));
const items = only ? allItems.filter((i) => i.kind === only) : allItems;
const labels = JSON.parse(fs.readFileSync(path.join(DIR, "labels.json"), "utf8"));
const allResults = JSON.parse(fs.readFileSync(path.join(DIR, `results-${model.replace(/[^a-z0-9.-]/gi, "_")}.json`), "utf8"));
const results = Object.fromEntries(items.filter((i) => allResults[i.id]).map((i) => [i.id, allResults[i.id]]));

// Paid prices per million tokens (in, out), for "what would this cost".
// Groq docs and Anthropic list prices, 2026-10. Check again before relying on them.
const PRICES = {
  "gpt-oss-20b": [0.075, 0.3],
  "gpt-oss-120b": [0.15, 0.6],
  "claude-haiku-5-5": [0.1, 0.5],
};

const STOP = new Set("the a an of for to and in on at by with is your from session".split(" "));
const words = (s) =>
  new Set(
    String(s ?? "")
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
const similarity = (a, b) => {
  const A = words(a), B = words(b);
  const common = [...A].filter((w) => B.has(w)).length;
  return common / Math.max(1, Math.min(A.size, B.size));
};
// Accepts HH:MM and HH:MM:SS (models sometimes write 23:59:59).
const minutes = (t) => (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t ?? "") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : null);
const timeClose = (a, b) => {
  const x = minutes(a), y = minutes(b);
  return x !== null && y !== null && Math.abs(x - y) <= 5; // "2 hours from now" can't be exact to the minute
};

const t = { extraFromMarketing: 0, labelled: 0, found: 0, dateOk: 0, dated: 0, timeOk: 0, timed: 0, extra: 0, extraInNothing: 0, nothingItems: 0, nothingClean: 0, placementLabelled: 0, placementFound: 0, unanswered: 0 };
const report = [];

items.forEach((item) => {
  const idx = allItems.indexOf(item);
  const want = labels[item.id]?.items ?? [];
  const r = results[item.id];
  if (!r) {
    t.unanswered++;
    return;
  }
  const got = (r.answer?.items ?? []).map((p) => ({ ...p, used: false }));
  const lines = [];

  for (const w of want) {
    t.labelled++;
    const isPlacement = w.type.startsWith("placement");
    if (isPlacement) t.placementLabelled++;
    let best = null, bestScore = -1;
    for (const p of got.filter((p) => !p.used)) {
      const sameDate = (w.date || "") === (p.date || "");
      const sim = similarity(w.title, p.title);
      const score = (sameDate ? 2 : 0) + sim + (p.type === w.type ? 0.5 : 0);
      if ((sameDate && (sim >= 0.15 || want.length === 1)) || sim >= 0.4) {
        if (score > bestScore) (best = p), (bestScore = score);
      }
    }
    if (!best) {
      lines.push(`  MISSED: ${w.title} | ${w.type} | ${w.date || "no date"} ${w.time}`);
      continue;
    }
    best.used = true;
    t.found++;
    if (isPlacement) t.placementFound++;
    const notes = [];
    if (w.date) {
      t.dated++;
      if (best.date === w.date) t.dateOk++;
      else notes.push(`date ${best.date || "none"} (want ${w.date})`);
    }
    if (w.time) {
      t.timed++;
      if (timeClose(best.time, w.time)) t.timeOk++;
      else notes.push(`time ${best.time || "none"} (want ${w.time})`);
    }
    if (best.type !== w.type) notes.push(`type ${best.type} (want ${w.type})`);
    lines.push(`  found: ${w.title} -> "${best.title}"${notes.length ? "  [" + notes.join("; ") + "]" : ""}`);
  }

  const extras = got.filter((p) => !p.used);
  t.extra += extras.length;
  // Marketing senders are skipped by the noise filter before the AI in the real app.
  if (item.group === "other_sender") t.extraFromMarketing += extras.length;
  if (want.length === 0) {
    t.nothingItems++;
    if (got.length === 0) t.nothingClean++;
    else t.extraInNothing += got.length;
  }
  for (const p of extras) lines.push(`  EXTRA: ${p.title} | ${p.type} | ${p.date} ${p.time} | conf ${p.confidence}`);
  if (lines.some((l) => /MISSED|EXTRA|\[/.test(l))) report.push(`#${idx + 1} ${item.subject.slice(0, 80)}\n${lines.join("\n")}`);
});

const usage = Object.values(results).map((r) => r.usage ?? {});
const tokensIn = usage.reduce((s, u) => s + (u.prompt_tokens ?? 0), 0);
const tokensOut = usage.reduce((s, u) => s + (u.completion_tokens ?? 0), 0);
const [pin, pout] = Object.entries(PRICES).find(([name]) => model.includes(name))?.[1] ?? [0, 0];
const answered = Object.keys(results).length;
const costPer = answered ? ((tokensIn * pin + tokensOut * pout) / 1e6 / answered) : 0;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}% (${a}/${b})` : "n/a");

console.log(`=== ${model} (${answered}/${items.length} answered) ===`);
console.log(`Real items found:        ${pct(t.found, t.labelled)}   <- most important`);
console.log(`  placement items found: ${pct(t.placementFound, t.placementLabelled)}`);
console.log(`Right date (when found): ${pct(t.dateOk, t.dated)}`);
console.log(`Right time (when found): ${pct(t.timeOk, t.timed)}`);
console.log(`"Nothing here" kept empty: ${pct(t.nothingClean, t.nothingItems)}`);
console.log(`False alarms: ${t.extra} extra items (${t.extraInNothing} in "Nothing here" emails)`);
console.log(`  of which from marketing senders (skipped before AI in the real app): ${t.extraFromMarketing}`);
console.log(`Tokens: ${tokensIn} in + ${tokensOut} out; paid cost ≈ $${costPer.toFixed(6)} per email`);
fs.writeFileSync(path.join(DIR, `score-${safe}.txt`), report.join("\n\n"));
console.log(`Details for review: secrets/testset/score-${safe}.txt (${report.length} items with a difference)`);

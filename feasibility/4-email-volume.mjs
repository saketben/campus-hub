// Stage 5, step 1: how much email does a student get, and from whom?
// Asks only for read-only Gmail. Reads the "envelope" of each email from the last
// 30 days (sender, recipients, labels, size), never the text. Prints totals only;
// nothing is saved except the sign-in token in secrets/ (ignored by Git).
import { google } from "googleapis";
import { getAuthClient, describeError } from "./auth.mjs";

const DAYS = 30;
const AT_A_TIME = 5;

const auth = await getAuthClient({
  fresh: process.argv.includes("--signin"),
  scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  tokenName: "token-gmail.json",
});
const gmail = google.gmail({ version: "v1", auth });
const { data: profile } = await gmail.users.getProfile({ userId: "me" });
const me = profile.emailAddress.toLowerCase();

// 1. Every email id from the last 30 days (spam and trash are excluded by default).
const ids = [];
let pageToken;
do {
  const { data } = await gmail.users.messages.list({ userId: "me", q: `newer_than:${DAYS}d`, maxResults: 500, pageToken });
  ids.push(...(data.messages ?? []).map((m) => m.id));
  pageToken = data.nextPageToken;
} while (pageToken);

// 2. The envelope of each, a few at a time. Gmail says "slow down" (429) if we ask
// too fast, so wait and retry a few times before giving up on an email.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function envelope(id) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { data } = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "To", "Cc"] });
      return data;
    } catch (e) {
      if (attempt >= 5) return { error: describeError(e) };
      await sleep(1000 * 2 ** attempt);
    }
  }
}
const envelopes = [];
for (let i = 0; i < ids.length; i += AT_A_TIME) {
  envelopes.push(...(await Promise.all(ids.slice(i, i + AT_A_TIME).map(envelope))));
}
const errors = new Map();
for (const m of envelopes.filter((m) => m.error)) errors.set(m.error, (errors.get(m.error) ?? 0) + 1);

const header = (m, name) => m.payload?.headers?.find((h) => h.name === name)?.value ?? "";
const address = (from) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
const domain = (addr) => addr.split("@")[1] ?? "(unknown)";

const ok = envelopes.filter((m) => !m.error);
const count = (pred) => ok.filter(pred).length;
const pct = (n) => `${n} (${Math.round((100 * n) / Math.max(ok.length, 1))}%)`;
const sentByMe = (m) => (m.labelIds ?? []).includes("SENT");
const received = ok.filter((m) => !sentByMe(m));

const byDomain = new Map();
for (const m of received) {
  const d = domain(address(header(m, "From")));
  byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
}
const toMePersonally = received.filter((m) => `${header(m, "To")} ${header(m, "Cc")}`.toLowerCase().includes(me));
const avgKB = ok.reduce((s, m) => s + (m.sizeEstimate ?? 0), 0) / Math.max(ok.length, 1) / 1024;

console.log(`Last ${DAYS} days: ${ok.length} emails (${received.length} received, ${ok.length - received.length} sent by you)`);
console.log(`Received per day: ${(received.length / DAYS).toFixed(1)}`);
for (const [error, n] of errors) console.log(`Could not read ${n} envelopes: ${error}`);
console.log(`\nGmail's own sorting of received email:`);
for (const [label, name] of [
  ["CATEGORY_PROMOTIONS", "Promotions"],
  ["CATEGORY_SOCIAL", "Social"],
  ["CATEGORY_UPDATES", "Updates"],
  ["CATEGORY_FORUMS", "Forums"],
  ["CATEGORY_PERSONAL", "Primary"],
]) {
  console.log(`  ${name.padEnd(11)} ${pct(received.filter((m) => (m.labelIds ?? []).includes(label)).length)}`);
}
console.log(`\nAddressed to you by name in To/Cc: ${pct(toMePersonally.length)}`);
console.log(`Sent via a group list or Bcc:      ${pct(received.length - toMePersonally.length)}`);
console.log(`\nAverage email size: ${avgKB.toFixed(0)} KB (includes formatting; text is usually much less)`);
console.log(`\nReceived, by sender organisation (top 15):`);
for (const [d, n] of [...byDomain].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(4)}  ${d}`);
}

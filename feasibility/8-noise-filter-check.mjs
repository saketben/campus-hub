// Stage 5: would a free, no-AI noise filter work for any student's inbox?
// Reads only envelopes (sender, labels, bulk-mail headers) of the last 30 days and
// prints counts. No email text is read and nothing is saved.
//   Rule being tested:
//   1. Always read: the student's own college domain + known placement portals.
//   2. Always skip: Classroom's notification emails (already synced from Classroom).
//   3. Other senders: skip if marked as bulk mail (List-Unsubscribe or
//      Precedence: bulk/list), read if written personally.
import { google } from "googleapis";
import { getAuthClient } from "./auth.mjs";

const DAYS = 30;
const PORTALS = ["edtex.in"];
const auth = await getAuthClient({ scopes: ["https://www.googleapis.com/auth/gmail.readonly"], tokenName: "token-gmail.json" });
const gmail = google.gmail({ version: "v1", auth });
const me = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress.toLowerCase();
const college = me.split("@")[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = [];
let pageToken;
do {
  const { data } = await gmail.users.messages.list({ userId: "me", q: `newer_than:${DAYS}d -from:me`, maxResults: 500, pageToken });
  ids.push(...(data.messages ?? []).map((m) => m.id));
  pageToken = data.nextPageToken;
} while (pageToken);

async function envelope(id) {
  for (let attempt = 1; ; attempt++) {
    try {
      const { data } = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "List-Unsubscribe", "Precedence"] });
      return data;
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}
const envs = [];
for (let i = 0; i < ids.length; i += 5) envs.push(...(await Promise.all(ids.slice(i, i + 5).map(envelope))));

const header = (m, name) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const domainOf = (m) => ((header(m, "From").match(/<([^>]+)>/)?.[1] ?? header(m, "From")).split("@")[1] ?? "").toLowerCase().replace(/>$/, "");
const isBulk = (m) => !!header(m, "List-Unsubscribe") || /bulk|list/i.test(header(m, "Precedence"));
const endsWith = (d, base) => d === base || d.endsWith("." + base);

const groups = { college: [], portal: [], classroom: [], otherBulk: [], otherPersonal: [] };
for (const m of envs) {
  const d = domainOf(m);
  if (endsWith(d, college)) groups.college.push(m);
  else if (PORTALS.some((p) => endsWith(d, p))) groups.portal.push(m);
  else if (d === "classroom.google.com") groups.classroom.push(m);
  else if (isBulk(m)) groups.otherBulk.push(m);
  else groups.otherPersonal.push(m);
}
const byDomain = (list) => {
  const c = new Map();
  for (const m of list) c.set(domainOf(m), (c.get(domainOf(m)) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${n} ${d}`).join(", ");
};

console.log(`Last ${DAYS} days: ${envs.length} received emails. College domain: ${college}`);
console.log(`READ  college domain:            ${groups.college.length}  (of which marked bulk: ${groups.college.filter(isBulk).length})`);
console.log(`READ  placement portal:          ${groups.portal.length}  (of which marked bulk: ${groups.portal.filter(isBulk).length})`);
console.log(`SKIP  Classroom notifications:   ${groups.classroom.length}`);
console.log(`SKIP  other senders, bulk-marked: ${groups.otherBulk.length}  -> ${byDomain(groups.otherBulk)}`);
console.log(`READ  other senders, personal:   ${groups.otherPersonal.length}  -> ${byDomain(groups.otherPersonal)}`);
const read = groups.college.length + groups.portal.length + groups.otherPersonal.length;
console.log(`\nAI would read ${read} of ${envs.length} (${Math.round((100 * read) / envs.length)}%), about ${(read / DAYS).toFixed(1)} a day.`);

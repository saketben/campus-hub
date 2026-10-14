// Stage 5, step 3: pick ~100 real items for the accuracy test and save them ONLY on
// this laptop, in secrets/testset/ (ignored by Git). Delete that folder after the test.
//   ~75 emails from iimtrichy.ac.in and the placement portal (personal ones first)
//   ~10 emails from other senders (checks the sender filter drops nothing important)
//   ~15 Classroom announcements from this term's courses
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { getAuthClient } from "./auth.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "secrets", "testset");
const DAYS = 30;
const IMPORTANT = /@(iimtrichy\.ac\.in|edtex\.in)>?$/i;
const SKIP_ALWAYS = /@classroom\.google\.com>?$/i; // already synced from Classroom itself
const WANT = { important: 75, other: 10, announcements: 15 };

const auth = await getAuthClient({
  fresh: process.argv.includes("--signin"),
  scopes: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
  ],
  tokenName: "token-testset.json",
});
const gmail = google.gmail({ version: "v1", auth });
const classroom = google.classroom({ version: "v1", auth });
const me = (await gmail.users.getProfile({ userId: "me" })).data.emailAddress.toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

// ---- Email text: prefer the plain-text part, else strip the HTML part. ----
const decode = (data) => Buffer.from(data ?? "", "base64url").toString("utf8");
function findPart(part, mime) {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}
function htmlToText(html) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}
function bodyText(payload) {
  const plain = findPart(payload, "text/plain");
  if (plain) return decode(plain.body.data);
  const html = findPart(payload, "text/html");
  return html ? htmlToText(decode(html.body.data)) : "";
}
function attachmentNames(part, names = []) {
  if (part.filename) names.push(part.filename);
  for (const p of part.parts ?? []) attachmentNames(p, names);
  return names;
}
const tidy = (s) => s.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

// ---- 1. Envelopes of the last 30 days. ----
const ids = [];
let pageToken;
do {
  const { data } = await gmail.users.messages.list({ userId: "me", q: `newer_than:${DAYS}d -from:me`, maxResults: 500, pageToken });
  ids.push(...(data.messages ?? []).map((m) => m.id));
  pageToken = data.nextPageToken;
} while (pageToken);

const envelopes = [];
for (let i = 0; i < ids.length; i += 5) {
  envelopes.push(
    ...(await Promise.all(
      ids.slice(i, i + 5).map((id) =>
        retry(() => gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "To", "Cc"] })).then((r) => r.data),
      ),
    )),
  );
}
const header = (m, name) => m.payload?.headers?.find((h) => h.name === name)?.value ?? "";
const fromOf = (m) => header(m, "From");
const toMe = (m) => `${header(m, "To")} ${header(m, "Cc")}`.toLowerCase().includes(me);

// ---- 2. Choose: personal important ones first, then an even spread of the rest. ----
const spread = (list, n) => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]));
const important = envelopes.filter((m) => IMPORTANT.test(fromOf(m)));
const personal = important.filter(toMe);
const group = important.filter((m) => !toMe(m));
const pickedImportant = [
  ...spread(personal, Math.min(personal.length, Math.ceil(WANT.important / 2))),
];
pickedImportant.push(...spread(group, WANT.important - pickedImportant.length));
const others = envelopes.filter((m) => !IMPORTANT.test(fromOf(m)) && !SKIP_ALWAYS.test(fromOf(m)));
const pickedOther = spread(others, WANT.other);

// ---- 3. Full text of the chosen emails. ----
const items = [];
for (const [group, list] of [["important", pickedImportant], ["other_sender", pickedOther]]) {
  for (const env of list) {
    const { data: m } = await retry(() => gmail.users.messages.get({ userId: "me", id: env.id, format: "full" }));
    items.push({
      id: `email:${m.id}`,
      kind: "email",
      group,
      to_me_personally: toMe(env),
      received_at: new Date(Number(m.internalDate)).toISOString(),
      from: header(m, "From"),
      subject: header(m, "Subject"),
      attachments: attachmentNames(m.payload),
      text: tidy(bodyText(m.payload)),
      link: `https://mail.google.com/mail/u/0/#all/${m.threadId}`,
    });
  }
}

// ---- 4. Classroom announcements from this term's courses (codes from lib/term-courses.ts). ----
const termFile = fs.readFileSync(path.join(here, "..", "lib", "term-courses.ts"), "utf8");
const codes = [...termFile.matchAll(/code: "([^"]+)"/g)].map((m) => m[1].toLowerCase());
const titles = [...termFile.matchAll(/title: "([^"]+)"/g)].map((m) => m[1].toLowerCase());
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const thisTerm = (name) => {
  const n = name.toLowerCase();
  return codes.some((c) => new RegExp(`(^|[^a-z0-9])${escape(c)}([^a-z0-9]|$)`).test(n)) || titles.some((t) => n.includes(t));
};
const { data: courseList } = await classroom.courses.list({ studentId: "me", courseStates: ["ACTIVE"], pageSize: 100 });
const courses = (courseList.courses ?? []).filter((c) => thisTerm(c.name));
const since = Date.now() - DAYS * 24 * 60 * 60 * 1000;
const announcements = [];
for (const c of courses) {
  const { data } = await classroom.courses.announcements.list({ courseId: c.id, pageSize: 50 });
  for (const a of data.announcements ?? []) {
    if (Date.parse(a.creationTime) >= since) announcements.push({ course: c.name, a });
  }
}
announcements.sort((x, y) => Date.parse(y.a.creationTime) - Date.parse(x.a.creationTime));
for (const { course, a } of spread(announcements, WANT.announcements)) {
  items.push({
    id: `announcement:${a.id}`,
    kind: "announcement",
    group: "announcement",
    course,
    received_at: a.creationTime,
    subject: (a.text ?? "").split("\n")[0].slice(0, 120),
    attachments: (a.materials ?? []).map((x) => x.driveFile?.driveFile?.title ?? x.link?.title ?? x.form?.title).filter(Boolean),
    text: tidy(a.text ?? ""),
    link: a.alternateLink,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "items.json"), JSON.stringify(items, null, 2));
console.log(`Saved ${items.length} items to secrets/testset/items.json (on this laptop only):`);
console.log(`  important emails: ${items.filter((i) => i.group === "important").length} (${items.filter((i) => i.to_me_personally).length} sent to you personally)`);
console.log(`  other-sender emails: ${items.filter((i) => i.group === "other_sender").length}`);
console.log(`  announcements: ${items.filter((i) => i.kind === "announcement").length} from ${courses.map((c) => c.name).join(", ")}`);
console.log(`  emails with attachments: ${items.filter((i) => i.attachments.length).length}`);

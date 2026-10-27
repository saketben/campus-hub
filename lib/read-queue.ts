import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { GoogleTokenError, getAccessToken } from "@/lib/google";
import { collegeDomainOf, gmailGet, isCampusSender } from "@/lib/gmail";
import {
  BadAnswerError,
  QuotaExhaustedError,
  RateLimitedError,
  TooLargeError,
  readMessage,
  type ExtractedItem,
  type MessageToRead,
} from "@/lib/ai-reader";

// Step 7: the AI reader. Takes "waiting" rows from message_queue, fetches each
// message's text from Gmail or Classroom, reuses a shared answer or asks the AI,
// saves the items found, and marks the row "read". The text lives only in memory
// for that one read: no body or subject is ever stored.
//
// Order (Saket, 2026-10-24, campus first): everyone's campus + placement-portal
// emails, then outside senders; newest first; students take turns. Classroom
// announcements go to their own AI model (its own free allowance), so they're
// read side by side with the emails, in a second lane.

const MAX_CHARS = 12_000; // ≈ 3,000 tokens: one read stays under Groq's 8,000 tokens a minute
const DAILY_READS_PER_STUDENT = 100; // Saket, 2026-10-27; reused answers don't count
const MAX_ATTEMPTS = 3;
const CLAIM_MINUTES = 10; // a read that started longer ago than this was cut off: try it again
const POSSIBLE_BELOW = 0.8; // lower confidence shows as "Possible deadline: confirm?"
const UNDATED_MATCH_DAYS = 30;
const UNREADABLE_TITLE = "Couldn't read this email automatically: please check it";

type Row = {
  user_id: string;
  source: "gmail" | "classroom";
  message_id: string;
  thread_id: string | null;
  course_id: string | null;
  sender: string | null;
  received_at: string;
  link: string | null;
  attempts: number;
};

// A message fetched for reading: what the AI gets, plus what the saved items need.
type Fetched = { message: MessageToRead; isReply: boolean; courseName: string | null };

export type ReadSummary = { read: number; reused: number; failed: number; tokens: number; stopped: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Network errors hide the real reason in `cause`.
const describe = (e: unknown) =>
  `${String(e)}${e instanceof Error && e.cause ? ` (${String(e.cause)})` : ""}`.slice(0, 200);
const isConnectionProblem = (e: unknown) => e instanceof TypeError || /HTTP (429|5\d\d)/.test(String(e));
const key = (r: Row) => `${r.user_id}|${r.source}|${r.message_id}`;

// ---- Fetching the text (kept in memory only) ----

type GmailPart = { mimeType?: string; filename?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { payload: GmailPart & { headers?: { name: string; value: string }[] } };

const decode = (data?: string) => Buffer.from(data ?? "", "base64url").toString("utf8");

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

function htmlToText(html: string) {
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

function attachmentNames(part: GmailPart, names: string[] = []) {
  if (part.filename) names.push(part.filename);
  for (const p of part.parts ?? []) attachmentNames(p, names);
  return names;
}

// Same tidying as the accuracy test (feasibility/5-build-testset.mjs), then cut to size.
const tidy = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim().slice(0, MAX_CHARS);

async function fetchEmail(token: string, row: Row): Promise<Fetched> {
  const m = await gmailGet<GmailMessage>(token, `/messages/${row.message_id}?format=full`);
  const header = (name: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const plain = findPart(m.payload, "text/plain");
  const html = plain ? null : findPart(m.payload, "text/html");
  const text = plain ? decode(plain.body?.data) : html ? htmlToText(decode(html.body?.data)) : "";
  return {
    message: {
      kind: "email",
      receivedAt: row.received_at,
      from: header("From"),
      subject: header("Subject"),
      attachments: attachmentNames(m.payload),
      text: tidy(text),
    },
    // Gmail also groups unrelated emails with the same subject into one thread;
    // only a real reply carries this marker.
    isReply: Boolean(header("In-Reply-To")),
    courseName: null,
  };
}

type Announcement = {
  text?: string;
  materials?: { driveFile?: { driveFile?: { title?: string } }; link?: { title?: string }; form?: { title?: string } }[];
};

async function fetchAnnouncement(token: string, row: Row, courseName: string): Promise<Fetched> {
  const res = await fetch(`https://classroom.googleapis.com/v1/courses/${row.course_id}/announcements/${row.message_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Classroom announcement -> HTTP ${res.status}`);
  const a = (await res.json()) as Announcement;
  return {
    message: {
      kind: "announcement",
      receivedAt: row.received_at,
      course: courseName,
      subject: (a.text ?? "").split("\n")[0].slice(0, 120), // as in the accuracy test
      attachments: (a.materials ?? [])
        .map((x) => x.driveFile?.driveFile?.title ?? x.link?.title ?? x.form?.title)
        .filter((t): t is string => Boolean(t)),
      text: tidy(a.text ?? ""),
    },
    isReply: false,
    courseName,
  };
}

// The shared-answer key. The received date is part of it: "tomorrow" in a
// re-sent copy of an email means a different day.
function fingerprint(m: MessageToRead) {
  const day = new Date(m.receivedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return createHash("sha256")
    .update(JSON.stringify([m.kind, m.from ?? m.course, m.subject, m.text, day]))
    .digest("hex");
}

// ---- Turning the AI's answer into item rows ----

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

// The AI answers in Indian time; the database stores UTC. A date without a time is
// "all day" (due by 23:59 IST, like Classroom); no date means "no date given".
function when(item: ExtractedItem) {
  if (!DATE.test(item.date) || Number.isNaN(ist(item.date, "00:00").getTime())) {
    return { due_at: null, all_day: false, ends_at: null };
  }
  if (!TIME.test(item.time)) return { due_at: ist(item.date, "23:59").toISOString(), all_day: true, ends_at: null };
  const start = ist(item.date, item.time);
  const end = TIME.test(item.end_time) ? ist(item.date, item.end_time) : null;
  return {
    due_at: start.toISOString(),
    all_day: false,
    ends_at: end && end > start ? end.toISOString() : null,
  };
}

// Where a message's items live: one prefix per message, so a re-read replaces them,
// and Gmail's start with the thread, so a reply can replace earlier ones.
function itemPrefix(row: Row) {
  return row.source === "gmail" ? `${row.thread_id}/${row.message_id}/` : `announcement:${row.message_id}:`;
}

// Words that say what kind of thing it is, not which one: two different
// companies' "application deadline" at 23:59 must not look like the same item.
const GENERIC = new Set(
  "the and for with from your you are this that last date deadline apply application applications registration register submission submit session class reminder today tomorrow form link round iim trichy".split(
    " ",
  ),
);
const words = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)) // "placements" = "placement"
      .filter((w) => w.length >= 3 && !GENERIC.has(w)),
  );

// Duplicate reminders: same type, same date and time, and most title words shared.
// When unsure it's not a duplicate (trust rule: better one extra than one missing).
type Comparable = { type: string; title: string; due_at: string | null };

function sameItem(a: Comparable, b: Comparable) {
  if (a.type !== b.type || !a.due_at || !b.due_at || Date.parse(a.due_at) !== Date.parse(b.due_at)) return false;
  return similarTitles(a, b);
}

// "Applications open for X" (no date) and, later, "Apply to X by Friday 7 pm":
// the dated one replaces the undated one.
function datedVersionOf(dated: Comparable, undated: Comparable) {
  return dated.type === undated.type && Boolean(dated.due_at) && !undated.due_at && similarTitles(dated, undated);
}

function similarTitles(a: Comparable, b: Comparable) {
  const wa = words(a.title);
  const wb = words(b.title);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared > 0 && shared / Math.min(wa.size, wb.size) >= 0.6;
}

// ---- The reader ----

export async function readQueue({
  userId,
  deadline,
  maxReads = Infinity,
}: {
  userId?: string; // only this student (page open); all students otherwise (background job)
  deadline: number; // stop starting new reads after this time (ms)
  maxReads?: number;
}): Promise<ReadSummary> {
  const admin = createAdminClient();
  const summary: ReadSummary = { read: 0, reused: 0, failed: 0, tokens: 0, stopped: null };
  const now = new Date();

  let waitingQuery = admin
    .from("message_queue")
    .select("user_id, source, message_id, thread_id, course_id, sender, received_at, link, attempts")
    .eq("status", "waiting")
    .or(`reading_since.is.null,reading_since.lt."${new Date(now.getTime() - CLAIM_MINUTES * 60_000).toISOString()}"`)
    .order("received_at", { ascending: false })
    .limit(5000);
  if (userId) waitingQuery = waitingQuery.eq("user_id", userId);
  const { data: waiting, error } = await waitingQuery;
  if (error) throw new Error(`loading queue: ${error.message}`);
  const rows = (waiting ?? []) as Row[];
  if (rows.length === 0) return summary;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: tokenRows } = await admin
    .from("google_tokens")
    .select("user_id, source, refresh_token_encrypted, google_email")
    .in("user_id", userIds);
  const tokenRowOf = (u: string, s: string) => (tokenRows ?? []).find((t) => t.user_id === u && t.source === s);

  // Course names for announcements (Classroom gives only the id).
  const { data: courses } = await admin.from("student_courses").select("user_id, course_id, course_name").in("user_id", userIds);
  const courseName = (u: string, c: string | null) =>
    (courses ?? []).find((x) => x.user_id === u && x.course_id === c)?.course_name as string | undefined;

  // AI reads since midnight IST, per student (reused answers cost nothing and don't count).
  const midnight = new Date(`${now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);
  const { data: today } = await admin
    .from("message_queue")
    .select("user_id")
    .in("user_id", userIds)
    .gte("read_at", midnight.toISOString())
    .gt("tokens", 0);
  const readsToday = new Map<string, number>();
  for (const r of today ?? []) readsToday.set(r.user_id, (readsToday.get(r.user_id) ?? 0) + 1);

  // Campus mail tier per row; then each lane's order.
  const collegeDomain = new Map(userIds.map((u) => [u, collegeDomainOf((tokenRowOf(u, "gmail")?.google_email as string) ?? "")]));
  const campus = (r: Row) => r.source === "gmail" && isCampusSender(r.sender ?? "", collegeDomain.get(r.user_id) ?? null);
  const emailLane = [...turns(rows.filter(campus)), ...turns(rows.filter((r) => r.source === "gmail" && !campus(r)))];
  const announcementLane = turns(rows.filter((r) => r.source === "classroom"));

  // One Google access token per student per source, fetched once per run.
  const accessTokens = new Map<string, Promise<string | null>>();
  const accessToken = (r: Row) => {
    const k = `${r.user_id}|${r.source}`;
    if (!accessTokens.has(k)) {
      const t = tokenRowOf(r.user_id, r.source);
      accessTokens.set(
        k,
        t
          ? getAccessToken(decrypt(t.refresh_token_encrypted as string)).catch((e) => {
              // Expired (weekly test-mode limit): rows wait until the student reconnects;
              // the sync marks the card "Reconnect".
              if (e instanceof GoogleTokenError) return null;
              throw e;
            })
          : Promise.resolve(null),
      );
    }
    return accessTokens.get(k)!;
  };

  const update = (r: Row, fields: Record<string, unknown>) =>
    admin.from("message_queue").update(fields).eq("user_id", r.user_id).eq("source", r.source).eq("message_id", r.message_id);
  const release = (r: Row) => update(r, { reading_since: null });

  // Claim a row so a run happening at the same time (page open + background job) skips it.
  async function claim(r: Row) {
    const stale = new Date(Date.now() - CLAIM_MINUTES * 60_000).toISOString();
    const { data } = await admin
      .from("message_queue")
      .update({ reading_since: new Date().toISOString() })
      .eq("user_id", r.user_id)
      .eq("source", r.source)
      .eq("message_id", r.message_id)
      .eq("status", "waiting")
      .or(`reading_since.is.null,reading_since.lt."${stale}"`)
      .select("message_id");
    return (data ?? []).length > 0;
  }

  async function giveUp(r: Row, reason: string) {
    summary.failed++;
    await update(r, { status: "failed", skip_reason: reason, reading_since: null, read_at: new Date().toISOString() });
    // Trust rule: a campus email we couldn't read still shows up, as a link to check.
    if (campus(r)) {
      await admin.from("items").upsert(
        {
          user_id: r.user_id,
          source: "gmail",
          source_id: `${itemPrefix(r)}unreadable`,
          type: "other",
          title: UNREADABLE_TITLE,
          due_at: null,
          all_day: false,
          confidence: 0,
          status: "needs_review",
          link: r.link,
          sender: r.sender,
          posted_at: r.received_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,source,source_id" },
      );
    }
  }

  // Saves one message's items. Rules from Saket's labelling (step 7c).
  async function saveItems(r: Row, f: Fetched, found: ExtractedItem[]) {
    const prefix = itemPrefix(r);
    // A re-read (edited announcement, retry) replaces what this message gave before.
    await admin.from("items").delete().eq("user_id", r.user_id).eq("source", r.source).like("source_id", `${prefix}%`);

    // A real reply that found something replaces the thread's earlier items: the
    // newest message wins (the AI also saw the quoted text). A reply that found
    // nothing ("Noted, thanks") leaves them.
    if (r.source === "gmail" && f.isReply && found.length > 0) {
      await admin
        .from("items")
        .delete()
        .eq("user_id", r.user_id)
        .eq("source", "gmail")
        .like("source_id", `${r.thread_id}/%`)
        .lt("posted_at", r.received_at);
    }

    const rows = found.map((item, n) => ({
      user_id: r.user_id,
      source: r.source,
      source_id: `${prefix}${n}`,
      type: item.type,
      title: item.title,
      ...when(item),
      confidence: Math.min(1, Math.max(0, item.confidence)),
      status: item.confidence < POSSIBLE_BELOW ? "needs_review" : "confirmed",
      link: r.link,
      sender: r.source === "gmail" ? r.sender : null,
      course_name: f.courseName,
      posted_at: r.received_at,
      updated_at: new Date().toISOString(),
    }));

    // Duplicate reminders (and the same event by email and by announcement) become
    // one item: the one already on the list stays. An undated item and a dated one
    // for the same thing become the dated one. Only recent undated items are
    // compared (the same company can come back next term).
    const dated = rows.filter((x) => x.due_at).map((x) => x.due_at as string);
    const types = [...new Set(rows.map((x) => x.type))];
    const recent = new Date(Date.parse(r.received_at) - UNDATED_MATCH_DAYS * 86_400_000).toISOString();
    const [{ data: sameTime }, { data: recentItems }] = await Promise.all([
      dated.length
        ? admin.from("items").select("id, type, title, due_at").eq("user_id", r.user_id).in("due_at", dated)
        : Promise.resolve({ data: [] }),
      admin
        .from("items")
        .select("id, type, title, due_at")
        .eq("user_id", r.user_id)
        .in("type", types)
        .gte("posted_at", recent)
        .not("source_id", "like", "%/unreadable"),
    ]);
    const existing = [...(sameTime ?? []), ...(recentItems ?? [])];
    const fresh = rows.filter((x) => !existing.some((e) => sameItem(e, x) || datedVersionOf(e, x)));
    const replaced = existing.filter((e) => fresh.some((x) => datedVersionOf(x, e))).map((e) => e.id as string);
    if (replaced.length) await admin.from("items").delete().in("id", replaced);
    if (fresh.length) {
      const { error } = await admin.from("items").upsert(fresh, { onConflict: "user_id,source,source_id" });
      if (error) throw new Error(`saving items: ${error.message}`);
    }
  }

  // Reads one row. Returns "stop" when this lane should stop for this run.
  async function readOne(r: Row): Promise<"ok" | "skip" | "stop"> {
    const token = await accessToken(r);
    if (!token) return "skip";
    if ((readsToday.get(r.user_id) ?? 0) >= DAILY_READS_PER_STUDENT) return "skip";
    if (!(await claim(r))) return "skip";

    let fetched: Fetched;
    try {
      if (r.source === "gmail") fetched = await fetchEmail(token, r);
      else fetched = await fetchAnnouncement(token, r, courseName(r.user_id, r.course_id) ?? "");
    } catch (e) {
      if (/HTTP 404/.test(String(e))) {
        // Deleted in Gmail or Classroom since it was queued.
        await update(r, { status: "skipped", skip_reason: "deleted", reading_since: null });
        return "ok";
      }
      if (isConnectionProblem(e)) return pause(r, e);
      return retryLater(r, describe(e));
    }

    const print = fingerprint(fetched.message);
    const { data: shared } = await admin.from("message_answers").select("items, model").eq("fingerprint", print).maybeSingle();
    let found: ExtractedItem[];
    let model: string;
    let tokens = 0;
    if (shared) {
      found = shared.items as ExtractedItem[];
      model = shared.model as string;
      summary.reused++;
    } else {
      try {
        const result = await readWithWaits(fetched.message);
        found = result.items;
        model = result.model;
        tokens = result.inputTokens + result.outputTokens;
      } catch (e) {
        if (e instanceof QuotaExhaustedError || e instanceof RateLimitedError) {
          await release(r);
          summary.stopped = e instanceof QuotaExhaustedError ? "daily AI allowance used up" : "AI busy";
          return "stop";
        }
        if (e instanceof TooLargeError) {
          await giveUp(r, "too long");
          return "ok";
        }
        // Only a broken answer counts as a try; an outage is nobody's fault.
        if (e instanceof BadAnswerError) return retryLater(r, describe(e));
        return pause(r, e);
      }
      await admin.from("message_answers").upsert({ fingerprint: print, items: found, model }, { ignoreDuplicates: true });
      readsToday.set(r.user_id, (readsToday.get(r.user_id) ?? 0) + 1);
      summary.tokens += tokens;
    }

    try {
      await saveItems(r, fetched, found);
    } catch (e) {
      return pause(r, e);
    }
    await update(r, {
      status: "read",
      read_at: new Date().toISOString(),
      fingerprint: print,
      tokens,
      model,
      reading_since: null,
      skip_reason: null,
    });
    summary.read++;
    return "ok";
  }

  // Network down, Groq or Google having a bad moment: leave the row as it was (no
  // try used up) and stop this lane until the next run.
  async function pause(r: Row, e: unknown): Promise<"stop"> {
    await update(r, { reading_since: null, skip_reason: describe(e) });
    summary.stopped = `paused: ${describe(e)}`;
    return "stop";
  }

  async function retryLater(r: Row, why: string): Promise<"ok"> {
    if (r.attempts + 1 >= MAX_ATTEMPTS) {
      await update(r, { attempts: r.attempts + 1 });
      await giveUp(r, `could not read: ${why.slice(0, 200)}`);
    } else {
      await update(r, { attempts: r.attempts + 1, reading_since: null, skip_reason: why.slice(0, 200) });
    }
    return "ok";
  }

  // Groq allows ~4–5 reads a minute: when it says "wait", wait if this run has time.
  async function readWithWaits(m: MessageToRead) {
    for (;;) {
      try {
        return await readMessage(m);
      } catch (e) {
        if (!(e instanceof RateLimitedError)) throw e;
        const waitMs = (e.retryAfterSeconds + 1) * 1000;
        if (Date.now() + waitMs > deadline) throw e;
        await sleep(waitMs);
      }
    }
  }

  const done = new Set<string>();
  let started = 0;
  const lane = async (list: Row[]) => {
    for (const r of list) {
      if (Date.now() > deadline) {
        summary.stopped ??= "out of time";
        return;
      }
      // Counted when a read starts, since the two lanes read at the same time.
      if (started >= maxReads) return;
      if (done.has(key(r))) continue;
      done.add(key(r));
      started++;
      if ((await readOne(r)) === "stop") return;
    }
  };
  await Promise.all([lane(emailLane), lane(announcementLane)]);
  return summary;
}

// Students take turns (round-robin), each student's messages newest first. In
// Gmail, a conversation's messages are kept together and read oldest first, so
// a reply is always read after the email it answers.
function turns(rows: Row[]): Row[] {
  const byUser = new Map<string, Row[][]>();
  const threads = new Map<string, Row[]>();
  for (const r of rows) {
    // Rows arrive newest first, so each thread is placed by its newest message.
    const t = r.thread_id ? `${r.user_id}|${r.thread_id}` : key(r);
    if (!threads.has(t)) {
      threads.set(t, []);
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(threads.get(t)!);
    }
    threads.get(t)!.push(r);
  }
  const queues = [...byUser.values()].map((groups) => groups.map((g) => [...g].reverse()));
  const order: Row[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length) order.push(...q[i]);
  }
  return order;
}

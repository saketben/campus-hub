import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { GoogleTokenError, getAccessToken } from "@/lib/google";
import type { SyncResult } from "@/lib/classroom";

// Step 6c: finds a student's new emails and decides which ones the AI should read.
// Reads only each email's envelope (sender, subject, mailing-list markers), never
// its text, and stores only the id, sender, time and decision in message_queue.
// The AI reading (step 7) fetches the text of "waiting" emails later.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const FIRST_LOOK_BACK_DAYS = 14; // first connect (Saket, 2026-10-17)
const REGISTRATION_LOOK_BACK_DAYS = 180; // competition sign-ups
const OVERLAP_MINUTES = 60; // re-list the last hour each time, so late arrivals aren't missed
const MIN_SECONDS_BETWEEN_SYNCS = 60;
const ENVELOPES_AT_A_TIME = 10;
const MAX_EMAILS_PER_SYNC = 1000; // newest first; a 14-day look-back is ~250 for a typical student

// Placement portals: always read (noise filter, 2026-10-16).
const PLACEMENT_PORTALS = ["edtex.in"];
// Competition platforms (Saket, 2026-11-12: Unstop mail is spam unless you entered
// that competition). Their update addresses write to followers too (Saket got
// Reliance T.U.P XII updates without registering), so an update is read only when
// it names a competition the student registered for. Registrations are learnt from
// the platform's confirmation emails and kept as skipped queue rows,
// skip_reason "registered: <competition>" (no extra table needed).
const COMPETITION_UPDATES = ["unstop.events", "unstop.email"];
const COMPETITION_ACCOUNT = ["emails.unstop.com"];
const REGISTERED_PREFIX = "registered: ";
const REGISTRATION_PATTERNS = [
  /request accepted by .+? for (.+?) being organi[sz]ed by/i, // joined a team
  /successfully registered (?:for|in) (.+?)(?:!|$| being organi[sz]ed)/i,
  /registration (?:is )?(?:confirmed|successful)[^|:]*[|:]\s*(.+)$/i,
  /you(?:'re| are) registered (?:for|in) (.+?)(?:!|$)/i,
];

// The competition a confirmation email is about, or null if it isn't one.
export function registrationName(subject: string): string | null {
  for (const p of REGISTRATION_PATTERNS) {
    const name = subject.match(p)?.[1]?.trim();
    if (name) return name;
  }
  return null;
}

const plain = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
// Does this text name one of the student's competitions? Compared on the name's
// first two words ("TrenDSetter 5.0- Marketing Track" → "trendsetter 5"), so a
// round's own title still matches.
export function namesCompetition(text: string, registered: string[]) {
  const t = plain(text);
  return registered.some((name) => {
    const key = plain(name).trim().split(" ").slice(0, 2).join(" ");
    return key.length >= 4 && t.includes(` ${key} `);
  });
}
export const isCompetitionPlatform = (sender: string) =>
  [...COMPETITION_UPDATES, ...COMPETITION_ACCOUNT, "unstop.news", "unstop.com"].some((s) =>
    isOrUnder(sender.split("@")[1] ?? "", s),
  );

// The competitions a student registered for, from their queue.
export async function registeredCompetitions(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin
    .from("message_queue")
    .select("skip_reason")
    .eq("user_id", userId)
    .like("skip_reason", `${REGISTERED_PREFIX}%`);
  return (data ?? []).map((r) => (r.skip_reason as string).slice(REGISTERED_PREFIX.length));
}
// Marketing senders that slip past the bulk-mail check: never read, even when the
// subject sounds personal ("Are you in, Saket?").
const MARKETING_SENDERS = ["unstop.news", "unstop.com"];
// Safety net (Saket, 2026-10-24): outside senders' bulk or marketing mail is still
// read when its subject sounds like news about the student personally, e.g. an
// external interview call or a case-comp round result. Generic hype words
// ("deadline", "last chance", "invitation") are left out on purpose: on Saket's
// inbox they matched most of the 126 marketing emails in 30 days; these words
// matched 3.
const PERSONAL_OUTCOME =
  /\b(shortlist(ed)?|interviews?|assessment|test link|next round|round \d|your application|application status|selected|qualified|congratulations|offer letter|results?)\b/i;
// Public webmail: if a student connects one of these, there's no "college domain".
const PUBLIC_WEBMAIL = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];

type Envelope = {
  id: string;
  threadId: string;
  internalDate: string;
  payload?: { headers?: { name: string; value: string }[] };
};

const isOrUnder = (domain: string, base: string) => domain === base || domain.endsWith(`.${base}`);

// The student's college domain, from the Gmail address they connected (none for public webmail).
export function collegeDomainOf(googleEmail: string): string | null {
  const domain = googleEmail.split("@")[1]?.toLowerCase() ?? "";
  return domain && !PUBLIC_WEBMAIL.includes(domain) ? domain : null;
}

// Campus mail: the college's own domain or a placement portal. The AI reads these first.
export function isCampusSender(sender: string, collegeDomain: string | null) {
  const domain = sender.split("@")[1] ?? "";
  return PLACEMENT_PORTALS.some((p) => isOrUnder(domain, p)) || Boolean(collegeDomain && isOrUnder(domain, collegeDomain));
}

function header(m: Envelope, name: string) {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function senderAddress(m: Envelope) {
  const from = header(m, "From");
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

// The noise filter. Returns null to read the email, or the reason it's skipped.
export function skipReason(m: Envelope, collegeDomain: string | null, registered: string[] = []): string | null {
  const sender = senderAddress(m);
  const domain = sender.split("@")[1] ?? "";
  const portal = PLACEMENT_PORTALS.some((p) => isOrUnder(domain, p));
  const subject = header(m, "Subject");

  if (domain === "classroom.google.com") return "classroom notification"; // already synced from Classroom
  if (portal && /^application submitted\b/i.test(subject)) return "portal receipt"; // free rule
  if (isCampusSender(sender, collegeDomain)) return null;
  if (COMPETITION_ACCOUNT.some((s) => isOrUnder(domain, s))) {
    const name = registrationName(subject);
    if (name) return `${REGISTERED_PREFIX}${name}`.slice(0, 200);
  }
  if (COMPETITION_UPDATES.some((s) => isOrUnder(domain, s))) {
    return namesCompetition(subject, registered) ? null : "competition not registered for";
  }
  if (MARKETING_SENDERS.some((s) => isOrUnder(domain, s))) return "marketing sender";
  if (PERSONAL_OUTCOME.test(header(m, "Subject"))) return null; // safety net, see above
  if (header(m, "List-Unsubscribe") || /bulk|list/i.test(header(m, "Precedence"))) return "bulk sender";
  return null; // someone outside writing personally, e.g. a recruiter
}

export async function gmailGet<T>(token: string, path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return (await res.json()) as T;
    // Gmail asks us to slow down now and then (as 429, or as 403 with a
    // "rateLimitExceeded" reason): wait and try again.
    const slowDown = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate ?limit/i.test(await res.text()));
    if (slowDown && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Gmail ${path.split("?")[0]} -> HTTP ${res.status}`);
  }
}

export async function syncGmail(userId: string, { force = false } = {}): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("google_tokens")
    .select("refresh_token_encrypted, google_email")
    .eq("user_id", userId)
    .eq("source", "gmail")
    .maybeSingle();
  const { data: status } = await admin
    .from("sync_status")
    .select("last_attempt_at, checked_until")
    .eq("user_id", userId)
    .eq("source", "gmail")
    .maybeSingle();
  if (!tokenRow || !status) return "not_connected";

  const now = new Date();
  if (!force && status.last_attempt_at && now.getTime() - Date.parse(status.last_attempt_at) < MIN_SECONDS_BETWEEN_SYNCS * 1000) {
    return "skipped";
  }
  const setStatus = (fields: Record<string, unknown>) =>
    admin.from("sync_status").update(fields).eq("user_id", userId).eq("source", "gmail");
  await setStatus({ last_attempt_at: now.toISOString() });

  let token: string;
  try {
    token = await getAccessToken(decrypt(tokenRow.refresh_token_encrypted));
  } catch (e) {
    const expired = e instanceof GoogleTokenError && e.needsReconnect;
    await setStatus({ state: expired ? "needs_reconnect" : "connected", last_error: String(e) });
    return expired ? "needs_reconnect" : "failed";
  }

  try {
    // Which emails to look at: since the last check (with an hour's overlap), or
    // the last 14 days on first connect. Emails the student sent are left out.
    const since = status.checked_until
      ? `after:${Math.floor(Date.parse(status.checked_until) / 1000) - OVERLAP_MINUTES * 60}`
      : `newer_than:${FIRST_LOOK_BACK_DAYS}d`;
    const ids: string[] = [];
    let pageToken = "";
    do {
      const q = encodeURIComponent(`${since} -from:me`);
      const page = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(
        token,
        `/messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`,
      );
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken ?? "";
    } while (pageToken && ids.length < MAX_EMAILS_PER_SYNC);

    // Also look further back for competition registrations (one cheap search), so
    // updates about a competition entered months ago are still recognised. Ones
    // already queued are looked at again unless already recorded as a sign-up
    // (emails queued before this rule existed were filed as marketing).
    const signUpQuery = encodeURIComponent(
      `from:${COMPETITION_ACCOUNT.join(" OR from:")} newer_than:${REGISTRATION_LOOK_BACK_DAYS}d ("request accepted" OR registered OR registration)`,
    );
    const signUpIds = ((await gmailGet<{ messages?: { id: string }[] }>(token, `/messages?q=${signUpQuery}&maxResults=50`)).messages ?? []).map(
      (m) => m.id,
    );
    ids.push(...signUpIds.filter((id) => !ids.includes(id)));

    // Skip ones already in the queue (the overlap), then fetch envelopes only.
    const { data: known } = ids.length
      ? await admin.from("message_queue").select("message_id, skip_reason").eq("user_id", userId).eq("source", "gmail").in("message_id", ids)
      : { data: [] };
    const knownIds = new Set((known ?? []).map((k) => k.message_id as string));
    const recorded = new Set((known ?? []).filter((k) => String(k.skip_reason).startsWith(REGISTERED_PREFIX)).map((k) => k.message_id as string));
    const recheck = signUpIds.filter((id) => knownIds.has(id) && !recorded.has(id));
    const newIds = ids.filter((id) => !knownIds.has(id));
    for (const id of recheck) {
      const m = await gmailGet<Envelope>(token, `/messages/${id}?format=metadata&metadataHeaders=Subject`);
      const name = registrationName(header(m, "Subject"));
      if (name) {
        await admin
          .from("message_queue")
          .update({ status: "skipped", skip_reason: `${REGISTERED_PREFIX}${name}`.slice(0, 200) })
          .eq("user_id", userId)
          .eq("source", "gmail")
          .eq("message_id", id);
      }
    }

    const envelopes: Envelope[] = [];
    const headers = ["From", "Subject", "List-Unsubscribe", "Precedence"].map((h) => `metadataHeaders=${h}`).join("&");
    for (let i = 0; i < newIds.length; i += ENVELOPES_AT_A_TIME) {
      envelopes.push(
        ...(await Promise.all(
          newIds.slice(i, i + ENVELOPES_AT_A_TIME).map((id) => gmailGet<Envelope>(token, `/messages/${id}?format=metadata&${headers}`)),
        )),
      );
    }

    const collegeDomain = collegeDomainOf(tokenRow.google_email as string);
    // Competitions entered so far, including confirmations in this very batch.
    const registered = [
      ...(await registeredCompetitions(admin, userId)),
      ...envelopes
        .filter((m) => COMPETITION_ACCOUNT.some((s) => isOrUnder(senderAddress(m).split("@")[1] ?? "", s)))
        .map((m) => registrationName(header(m, "Subject")))
        .filter((n): n is string => Boolean(n)),
    ];
    const rows = envelopes.map((m) => {
      const reason = skipReason(m, collegeDomain, registered);
      return {
        user_id: userId,
        source: "gmail",
        message_id: m.id,
        thread_id: m.threadId,
        sender: senderAddress(m),
        received_at: new Date(Number(m.internalDate)).toISOString(),
        link: `https://mail.google.com/mail/?authuser=${encodeURIComponent(tokenRow.google_email as string)}#all/${m.id}`,
        status: reason ? "skipped" : "waiting",
        skip_reason: reason,
      };
    });
    if (rows.length) {
      const { error } = await admin
        .from("message_queue")
        .upsert(rows, { onConflict: "user_id,source,message_id", ignoreDuplicates: true });
      if (error) throw new Error(`saving queue: ${error.message}`);
    }

    await setStatus({ state: "connected", last_synced_at: now.toISOString(), checked_until: now.toISOString(), last_error: null });
    return "synced";
  } catch (e) {
    // Network errors hide the real reason in `cause`.
    const cause = e instanceof Error && e.cause ? ` (${String(e.cause)})` : "";
    await setStatus({ last_error: `${String(e)}${cause}` });
    return "failed";
  }
}

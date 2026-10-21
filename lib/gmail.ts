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
const OVERLAP_MINUTES = 60; // re-list the last hour each time, so late arrivals aren't missed
const MIN_SECONDS_BETWEEN_SYNCS = 60;
const ENVELOPES_AT_A_TIME = 10;
const MAX_EMAILS_PER_SYNC = 1000; // newest first; a 14-day look-back is ~250 for a typical student

// Placement portals: always read (noise filter, 2026-10-16).
const PLACEMENT_PORTALS = ["edtex.in"];
// Marketing senders that slip past the bulk-mail check: never read.
const MARKETING_SENDERS = ["unstop.news", "unstop.com"];
// Public webmail: if a student connects one of these, there's no "college domain".
const PUBLIC_WEBMAIL = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];

type Envelope = {
  id: string;
  threadId: string;
  internalDate: string;
  payload?: { headers?: { name: string; value: string }[] };
};

const isOrUnder = (domain: string, base: string) => domain === base || domain.endsWith(`.${base}`);

function header(m: Envelope, name: string) {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function senderAddress(m: Envelope) {
  const from = header(m, "From");
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

// The noise filter. Returns null to read the email, or the reason it's skipped.
export function skipReason(m: Envelope, collegeDomain: string | null): string | null {
  const sender = senderAddress(m);
  const domain = sender.split("@")[1] ?? "";
  const portal = PLACEMENT_PORTALS.some((p) => isOrUnder(domain, p));

  if (domain === "classroom.google.com") return "classroom notification"; // already synced from Classroom
  if (portal && /^application submitted\b/i.test(header(m, "Subject"))) return "portal receipt"; // free rule
  if (portal || (collegeDomain && isOrUnder(domain, collegeDomain))) return null;
  if (MARKETING_SENDERS.some((s) => isOrUnder(domain, s))) return "marketing sender";
  if (header(m, "List-Unsubscribe") || /bulk|list/i.test(header(m, "Precedence"))) return "bulk sender";
  return null; // someone outside writing personally, e.g. a recruiter
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return (await res.json()) as T;
    // Gmail asks us to slow down now and then: wait and try again.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
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

    // Skip ones already in the queue (the overlap), then fetch envelopes only.
    const { data: known } = ids.length
      ? await admin.from("message_queue").select("message_id").eq("user_id", userId).eq("source", "gmail").in("message_id", ids)
      : { data: [] };
    const knownIds = new Set((known ?? []).map((k) => k.message_id as string));
    const newIds = ids.filter((id) => !knownIds.has(id));

    const envelopes: Envelope[] = [];
    const headers = ["From", "Subject", "List-Unsubscribe", "Precedence"].map((h) => `metadataHeaders=${h}`).join("&");
    for (let i = 0; i < newIds.length; i += ENVELOPES_AT_A_TIME) {
      envelopes.push(
        ...(await Promise.all(
          newIds.slice(i, i + ENVELOPES_AT_A_TIME).map((id) => gmailGet<Envelope>(token, `/messages/${id}?format=metadata&${headers}`)),
        )),
      );
    }

    const emailDomain = (tokenRow.google_email as string).split("@")[1]?.toLowerCase() ?? "";
    const collegeDomain = emailDomain && !PUBLIC_WEBMAIL.includes(emailDomain) ? emailDomain : null;
    const rows = envelopes.map((m) => {
      const reason = skipReason(m, collegeDomain);
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

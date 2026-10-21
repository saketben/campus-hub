import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClassroom, type SyncResult } from "@/lib/classroom";
import { syncGmail } from "@/lib/gmail";

// The background refresh (D1). Supabase Cron calls this every 30 minutes with the
// CRON_SECRET password; it refreshes every connected student's Classroom and
// Gmail, a few at a time.
export const maxDuration = 300;

const AT_A_TIME = 5;

function authorized(request: NextRequest) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return process.env.CRON_SECRET && given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // One job per connection: a student with Classroom and Gmail gets two.
  const { data: connections } = await createAdminClient().from("google_tokens").select("user_id, source");
  const queue = (connections ?? []).map((c) => ({ userId: c.user_id as string, source: c.source as "classroom" | "gmail" }));
  const counts: Record<string, Partial<Record<SyncResult, number>>> = { classroom: {}, gmail: {} };

  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const result = job.source === "gmail" ? await syncGmail(job.userId) : await syncClassroom(job.userId);
      counts[job.source][result] = (counts[job.source][result] ?? 0) + 1;
    }
  };
  await Promise.all(Array.from({ length: AT_A_TIME }, worker));

  return NextResponse.json(counts);
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClassroom, type SyncResult } from "@/lib/classroom";

// The background refresh (D1). Supabase Cron calls this every 30 minutes with the
// CRON_SECRET password; it refreshes every connected student, a few at a time.
export const maxDuration = 300;

const AT_A_TIME = 5;

function authorized(request: NextRequest) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return process.env.CRON_SECRET && given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: students } = await createAdminClient().from("google_tokens").select("user_id");
  const queue = (students ?? []).map((s) => s.user_id as string);
  const counts: Partial<Record<SyncResult, number>> = {};

  const worker = async () => {
    for (let userId = queue.shift(); userId; userId = queue.shift()) {
      const result = await syncClassroom(userId);
      counts[result] = (counts[result] ?? 0) + 1;
    }
  };
  await Promise.all(Array.from({ length: AT_A_TIME }, worker));

  return NextResponse.json({ students: students?.length ?? 0, ...counts });
}

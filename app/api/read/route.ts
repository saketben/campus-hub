import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readQueue } from "@/lib/read-queue";

// Called by the home page right after its Gmail/Classroom check: the AI reads a
// few of this student's newest waiting messages, so a new email shows within
// seconds. The 30-minute background job reads the rest.
export const maxDuration = 60;

const READS_ON_OPEN = 3;
const SECONDS_ON_OPEN = 40;

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ read: 0 }, { status: 401 });

  const summary = await readQueue({ userId, maxReads: READS_ON_OPEN, deadline: Date.now() + SECONDS_ON_OPEN * 1000 });
  return NextResponse.json(summary);
}

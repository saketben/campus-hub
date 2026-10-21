import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncGmail } from "@/lib/gmail";

// Called by the home page each time it opens, like the Classroom check. syncGmail
// itself makes sure this runs at most once a minute per student.
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ result: "signed_out" }, { status: 401 });

  return NextResponse.json({ result: await syncGmail(userId) });
}

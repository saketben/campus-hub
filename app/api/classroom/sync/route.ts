import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncClassroom } from "@/lib/classroom";

// Called by the home page each time it opens (D1). syncClassroom itself makes sure
// this runs at most once a minute per student.
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ result: "signed_out" }, { status: 401 });

  return NextResponse.json({ result: await syncClassroom(userId) });
}

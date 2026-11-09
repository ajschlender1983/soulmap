import { NextResponse } from "next/server";
import { readState } from "@/lib/state";
import { liveFromState, scoreAll } from "@/lib/score";
import { progress } from "@/lib/engine";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await readState(profileIdFrom(req));
  const live = liveFromState(s);
  return NextResponse.json({ ...live, answered: s.answers.length, total: scoreAll(s).total_items, status: s.status, turns: s.turns, chat_id: s.chat_id, profile: s.profile, interview: progress(s) }, { headers: { "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";
import { updateState, replaceSessionTurns } from "@/lib/state";
import { retell } from "@/lib/retell-server";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { call_id, turns: clientTurns } = (await req.json().catch(() => ({}))) as { call_id?: string; turns?: { role: string; content: string }[] };
  let turns: { role: string; content: string }[] | null = clientTurns?.length ? clientTurns : null;
  if (call_id) {
    // Retell needs a few seconds to finalise the transcript.
    // Retell's final transcript is authoritative; the client copy is the fallback. Two quick tries, then move on.
    for (let i = 0; i < 2; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const c = (await retell().call.retrieve(call_id).catch(() => null)) as { transcript_object?: { role: string; content: string }[] } | null;
      if (c?.transcript_object?.length) { turns = c.transcript_object; break; }
    }
  }
  const s = await updateState((s) => {
    if (s.status === "in_call") s.status = "ended";
    s.call_id = null;
    s.ended_at = new Date().toISOString();
    if (call_id && turns) replaceSessionTurns(s, call_id, "voice", turns);
  }, profileIdFrom(req));
  return NextResponse.json({ ok: true, answers: s.answers.length, turns: s.turns.length });
}

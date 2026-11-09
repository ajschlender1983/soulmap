import { NextResponse } from "next/server";
import { readState, updateState, replaceSessionTurns, emptyState } from "@/lib/state";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json(await readState(profileIdFrom(req)), { headers: { "cache-control": "no-store" } });
}

/** Human overrides and client-side transcript pushes. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { call_id?: string; turns?: { role: string; content: string }[]; override?: Record<string, string>; reset?: boolean };
  const id = profileIdFrom(req);
  const s = await updateState((s) => {
    if (body.reset) return { ...emptyState(id), profile: s.profile }; // a reset keeps who the person is
    if (body.call_id && Array.isArray(body.turns)) replaceSessionTurns(s, body.call_id, "voice", body.turns);
    if (body.override) s.override = { ...s.override, ...body.override };
  }, id);
  return NextResponse.json(s);
}

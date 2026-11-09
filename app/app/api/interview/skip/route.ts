import { NextResponse } from "next/server";
import { interviewSkip } from "@/lib/interview";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Body: `{ item_id? }` (defaults to the current item). First skip re-asks at the end of the section; the second is final. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { item_id?: string };
  return NextResponse.json(await interviewSkip(profileIdFrom(req), body.item_id), { headers: { "cache-control": "no-store" } });
}

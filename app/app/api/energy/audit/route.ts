import { NextResponse } from "next/server";
import { profileIdFrom } from "@/lib/profile";
import { writeAudit } from "@/lib/energy";
import { aiConfig } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST: write this week's audit now (it is also written once a week on its own, lib/autosync.ts). */
export async function POST(req: Request) {
  if (!(await aiConfig()).engine) return NextResponse.json({ error: "Choose who does the thinking first: Claude or this Mac." }, { status: 409 });
  try {
    return NextResponse.json({ ok: true, audit: await writeAudit(profileIdFrom(req)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The audit could not be written." }, { status: 500 });
  }
}

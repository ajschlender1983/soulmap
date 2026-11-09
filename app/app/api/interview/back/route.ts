import { NextResponse } from "next/server";
import { interviewBack } from "@/lib/interview";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reopens the previous item of the current section with `item.previous_value` set. `reopened: false` when at the section start. */
export async function POST(req: Request) {
  return NextResponse.json(await interviewBack(profileIdFrom(req)), { headers: { "cache-control": "no-store" } });
}

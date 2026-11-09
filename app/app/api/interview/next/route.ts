import { NextResponse } from "next/server";
import { interviewNext } from "@/lib/interview";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The next question for this person: `{ item, intro?, progress, done, status }`. Idempotent: polling never repeats a turn. */
export async function POST(req: Request) {
  return NextResponse.json(await interviewNext(profileIdFrom(req)), { headers: { "cache-control": "no-store" } });
}
export const GET = POST;

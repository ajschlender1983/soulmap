import { NextResponse } from "next/server";
import { teamCards } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The team view: for each consented person with a report, only { id, name, card }. */
export async function GET() {
  return NextResponse.json({ team: await teamCards() }, { headers: { "cache-control": "no-store" } });
}

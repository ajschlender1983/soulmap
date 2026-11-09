import { NextResponse } from "next/server";
import { HOSTED, connectorStatuses } from "@/lib/connectors";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: each connector's status for this person. Hosted: there is no Mac to connect to. */
export async function GET(req: Request) {
  if (HOSTED) return NextResponse.json({ hosted: true, connectors: [] });
  try { return NextResponse.json({ hosted: false, connectors: await connectorStatuses(profileIdFrom(req)) }, { headers: { "cache-control": "no-store" } }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 }); }
}

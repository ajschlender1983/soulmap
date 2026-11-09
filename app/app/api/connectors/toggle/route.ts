import { NextResponse } from "next/server";
import { HOSTED, isConnectorId, setConnector } from "@/lib/connectors";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST {id, enabled}: saved on the profile as connectors[id].enabled. Nightly sync skips what is off. */
export async function POST(req: Request) {
  if (HOSTED) return NextResponse.json({ hosted: true, error: "connections work on the Mac install" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; enabled?: unknown };
  if (!isConnectorId(b.id) || typeof b.enabled !== "boolean") return NextResponse.json({ error: "expected {id, enabled}" }, { status: 400 });
  try { return NextResponse.json({ ok: true, id: b.id, ...(await setConnector(profileIdFrom(req), b.id, b.enabled)) }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 }); }
}

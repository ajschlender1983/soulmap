import { NextResponse } from "next/server";
import { HOSTED, isConnectorId, syncConnectors, type ConnectorId } from "@/lib/connectors";
import { profileIdFrom } from "@/lib/profile";
import { aiConfig } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Windows sampled per source: Claude Haiku is cheap and fast enough to read most of it; the local model is not. */
const syncWindows = async () => ((await aiConfig()).engine === "claude" ? 60 : 4);

/** POST {ids?: ConnectorId[], max_windows?: number}: import what each connector has, then score + summary once. */
export async function POST(req: Request) {
  if (HOSTED) return NextResponse.json({ hosted: true, error: "connections work on the Mac install" }, { status: 400 });
  const id = profileIdFrom(req);
  const b = (await req.json().catch(() => ({}))) as { ids?: unknown; max_windows?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter(isConnectorId) : undefined;
  if (Array.isArray(b.ids) && ids!.length !== b.ids.length) return NextResponse.json({ error: "unknown connector id" }, { status: 400 });
  const maxWindows = typeof b.max_windows === "number" && b.max_windows > 0 ? b.max_windows : await syncWindows();
  try {
    const r = await syncConnectors(id, ids as ConnectorId[] | undefined, maxWindows);
    return NextResponse.json({ ok: true, ...r }, { headers: { "cache-control": "no-store" } });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 409 }); }
}

import { NextResponse } from "next/server";
import { profileIdFrom } from "@/lib/profile";
import { disconnect, isRemoteId } from "@/lib/remote-connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST {id}: forget this Mac's sign-in for Otter or Granola. Imported evidence stays until purged. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (!isRemoteId(b.id)) return NextResponse.json({ error: "expected {id: otter|granola}" }, { status: 400 });
  await disconnect(profileIdFrom(req), b.id);
  return NextResponse.json({ ok: true });
}

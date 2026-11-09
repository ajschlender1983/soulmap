import { NextResponse } from "next/server";
import { updateState } from "@/lib/state";
import { profileIdFrom } from "@/lib/profile";
import { newToken } from "@/lib/peer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Creates a shareable peer-input link for the current person and returns its path. */
export async function POST(req: Request) {
  const link = { token: newToken(), created_at: new Date().toISOString() };
  await updateState((s) => { s.peer_links = [...(s.peer_links ?? []), link]; }, profileIdFrom(req));
  return NextResponse.json({ ok: true, token: link.token, path: `${BASE}/peer/${link.token}` });
}

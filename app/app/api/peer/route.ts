import { NextResponse } from "next/server";
import { readState } from "@/lib/state";
import { profileIdFrom } from "@/lib/profile";
import { summarize } from "@/lib/peer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Owner view: averages (2 and 7 reverse-keyed), rater count, open answers, and the newest link. */
export async function GET(req: Request) {
  const s = await readState(profileIdFrom(req));
  const links = s.peer_links ?? [];
  const latest = links[links.length - 1];
  return NextResponse.json({ ...summarize(s.peer_responses), link: latest ? `${BASE}/peer/${latest.token}` : null }, { headers: { "cache-control": "no-store" } });
}

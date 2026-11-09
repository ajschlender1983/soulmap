import { NextResponse } from "next/server";
import { listProfiles, updateState } from "@/lib/state";
import { ownerOfToken, parseResponse, peerItemsFor } from "@/lib/peer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** What the peer page needs: the owner's first name and the items. Never the owner's answers. */
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const owner = await ownerOfToken(token, await listProfiles());
  if (!owner) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  return NextResponse.json({ name: owner.state.profile.name, ...peerItemsFor(owner.state.profile.name) }, { headers: { "cache-control": "no-store" } });
}

/** Stores one anonymous response on the OWNER's state. The rater is never recorded. */
export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const owner = await ownerOfToken(token, await listProfiles());
  if (!owner) return NextResponse.json({ ok: false, error: "This link is not valid." }, { status: 404 });
  const r = parseResponse(await req.json().catch(() => null));
  if (!r) return NextResponse.json({ ok: false, error: "Every item needs a number from 1 to 5." }, { status: 400 });
  const s = await updateState((st) => { st.peer_responses = [...(st.peer_responses ?? []), r]; }, owner.id);
  return NextResponse.json({ ok: true, n: s.peer_responses?.length ?? 0 });
}

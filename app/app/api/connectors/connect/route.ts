import { NextResponse } from "next/server";
import { HOSTED } from "@/lib/connectors";
import { profileIdFrom } from "@/lib/profile";
import { isRemoteId, publicOrigin, startConnect } from "@/lib/remote-connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** GET ?id=otter|granola: send the browser to the vendor's sign-in page. */
export async function GET(req: Request) {
  if (HOSTED) return NextResponse.json({ error: "connections work on the Mac install" }, { status: 400 });
  const cid = new URL(req.url).searchParams.get("id");
  if (!isRemoteId(cid)) return NextResponse.json({ error: "expected ?id=otter or granola" }, { status: 400 });
  const origin = publicOrigin(req);
  try {
    const url = await startConnect(profileIdFrom(req), cid, `${origin}${BASE}/api/connectors/callback`);
    return NextResponse.redirect(url.toString(), 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed";
    return NextResponse.redirect(`${origin}${BASE}/evidence?p=${encodeURIComponent(profileIdFrom(req))}&connect_error=${encodeURIComponent(msg)}`, 302);
  }
}

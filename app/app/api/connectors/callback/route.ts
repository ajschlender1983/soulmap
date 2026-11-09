import { NextResponse } from "next/server";
import { finishConnect, publicOrigin } from "@/lib/remote-connectors";
import { DEFAULT_PROFILE } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** GET ?code&state from the vendor: finish the sign-in, then back to the evidence page. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const origin = publicOrigin(req);
  const state = q.get("state") ?? "";
  const person = state.split(".")[0] || DEFAULT_PROFILE;
  const back = (extra: string) => NextResponse.redirect(`${origin}${BASE}/evidence?p=${encodeURIComponent(person)}&${extra}`, 302);
  if (q.get("error")) return back(`connect_error=${encodeURIComponent(q.get("error_description") ?? q.get("error")!)}`);
  const code = q.get("code");
  if (!code || !state) return back("connect_error=missing%20code");
  try {
    const { cid } = await finishConnect(state, code);
    return back(`connected=${cid}`);
  } catch (err) { return back(`connect_error=${encodeURIComponent(err instanceof Error ? err.message : "failed")}`); }
}

import { NextResponse } from "next/server";
import { readState, updateState } from "@/lib/state";
import { retellFetch } from "@/lib/retell-server";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const id = profileIdFrom(req);
  const s = await readState(id);
  if (s.chat_id) await retellFetch("/end-chat/" + s.chat_id, undefined, "PATCH").catch(() => null);
  await updateState((st) => { st.chat_id = null; if (st.status === "in_chat") st.status = "ended"; }, id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { retell } from "@/lib/retell-server";
import { readState, updateState } from "@/lib/state";
import { dynamicVars } from "@/lib/session";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const id = profileIdFrom(req);
  const agentId = process.env.RETELL_AGENT_ID;
  if (!agentId) return NextResponse.json({ error: "server is missing RETELL_AGENT_ID" }, { status: 500 });
  try {
    const prev = await readState(id);
    // Tell the agent what is already known so a resumed call skips it.
    const call = await retell().call.createWebCall({ agent_id: agentId, retell_llm_dynamic_variables: dynamicVars(prev), metadata: { profile_id: id } });
    await updateState((s) => { s.status = "in_call"; s.call_id = call.call_id; s.started_at = s.started_at ?? new Date().toISOString(); }, id);
    return NextResponse.json({ access_token: call.access_token, call_id: call.call_id, transport: call.transport, ice_servers: call.ice_servers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `retell rejected the call: ${message}` }, { status: 502 });
  }
}

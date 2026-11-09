import { NextResponse } from "next/server";
import { readState, updateState } from "@/lib/state";
import { dynamicVars } from "@/lib/session";
import { retellFetch } from "@/lib/retell-server";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opens (or reuses) a Retell chat session on the chat twin of the interviewer. */
export async function POST(req: Request) {
  const { fresh } = (await req.json().catch(() => ({}))) as { fresh?: boolean };
  const agentId = process.env.RETELL_CHAT_AGENT_ID;
  if (!agentId) return NextResponse.json({ error: "server is missing RETELL_CHAT_AGENT_ID (run npm run setup-retell)" }, { status: 500 });
  const id = profileIdFrom(req);
  const prev = await readState(id);
  const lastMode = prev.turns.length ? prev.turns[prev.turns.length - 1].mode : "chat";
  if (prev.chat_id && prev.status === "in_chat" && !(fresh && lastMode === "voice")) return NextResponse.json({ chat_id: prev.chat_id, reused: true });
  if (prev.chat_id) await retellFetch("/end-chat/" + prev.chat_id, undefined, "PATCH").catch(() => null);
  try {
    const chat = await retellFetch<{ chat_id: string }>("/create-chat", { agent_id: agentId, retell_llm_dynamic_variables: dynamicVars(prev) });
    await updateState((s) => { s.status = "in_chat"; s.chat_id = chat.chat_id; s.started_at = s.started_at ?? new Date().toISOString(); }, id);
    return NextResponse.json({ chat_id: chat.chat_id, reused: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "chat failed" }, { status: 502 });
  }
}

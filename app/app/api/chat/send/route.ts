import { NextResponse } from "next/server";
import { readState, updateState } from "@/lib/state";
import { retellFetch } from "@/lib/retell-server";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { message_id?: string; role: string; content?: string; name?: string };

export async function POST(req: Request) {
  const { content } = (await req.json().catch(() => ({}))) as { content?: string };
  const id = profileIdFrom(req);
  const s = await readState(id);
  if (!s.chat_id) return NextResponse.json({ error: "no open chat" }, { status: 400 });
  const text = (content ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  const chatId = s.chat_id;
  const now = new Date().toISOString();
  await updateState((st) => { st.turns.push({ role: "user", content: text, mode: "chat", session_id: chatId, at: now }); }, id);
  try {
    const res = await retellFetch<{ messages: Msg[] }>("/create-chat-completion", { chat_id: chatId, content: text });
    const agentMsgs = (res.messages ?? []).filter((m) => m.role === "agent" && m.content && m.content.trim());
    await updateState((st) => {
      for (const m of agentMsgs) st.turns.push({ role: "agent", content: m.content!.trim(), mode: "chat", session_id: chatId, at: new Date().toISOString() });
      st.transcript = st.turns.map((t) => `${t.role === "agent" ? "Agent" : st.profile.name}: ${t.content}`).join("\n");
    }, id);
    return NextResponse.json({ ok: true, agent: agentMsgs.map((m) => m.content) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "chat failed" }, { status: 502 });
  }
}

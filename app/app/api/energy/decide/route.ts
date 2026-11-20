import { NextResponse } from "next/server";
import { profileIdFrom } from "@/lib/profile";
import { decide } from "@/lib/energy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { audit, adjustment, decision: "yes" | "no" | "nuance", nuance? }. Yes files it as a correction; nothing changes without it. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { audit?: string; adjustment?: string; decision?: string; nuance?: string };
  if (!b.audit || !b.adjustment || !["yes", "no", "nuance"].includes(b.decision ?? "")) return NextResponse.json({ error: "audit, adjustment and decision are required" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, adjustment: await decide(profileIdFrom(req), b.audit, b.adjustment, b.decision as "yes" | "no" | "nuance", b.nuance) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "could not save" }, { status: 400 });
  }
}

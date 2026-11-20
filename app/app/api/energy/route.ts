import { NextResponse } from "next/server";
import { profileIdFrom } from "@/lib/profile";
import { addCheckin, readEnergy, signals } from "@/lib/energy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Energy Audit (lib/energy.ts). Private to each person.
 * GET: check-ins, the latest audit, and this week's background signals (without the person's own lines).
 * POST { task, energy 0-10, notes?, feedback?, agent? }: one check-in. Agents can call this too.
 */
export async function GET(req: Request) {
  const id = profileIdFrom(req);
  const s = await readEnergy(id);
  const sig = await signals(id, new Date(Date.now() - 7 * 24 * 3600_000));
  return NextResponse.json({
    checkins: s.checkins.slice(-50).reverse(),
    audit: s.audits[s.audits.length - 1] ?? null,
    week: { ai: sig.ai, meetings: sig.meetings, corrections: sig.corrections.length },
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const c = await addCheckin(profileIdFrom(req), body);
    return NextResponse.json({ ok: true, checkin: c });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "could not save" }, { status: 400 });
  }
}

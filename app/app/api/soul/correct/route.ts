import { NextResponse } from "next/server";
import { readState, updateState } from "@/lib/state";
import { profileIdFrom } from "@/lib/profile";
import { fileCorrection, parseCorrection, type Correction } from "@/lib/corrections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Soul API's correction entry (SPEC, correction loop). Any agent, the app's "Tell my Soul Map"
 * box, or a hook can POST here. Filing is in lib/corrections.ts. Corrections apply immediately.
 *
 * Body: { text, source?, rule? }   GET lists them   DELETE { at } undoes one.
 */
export async function GET(req: Request) {
  const s = await readState(profileIdFrom(req));
  const corrections = s.notes.map(parseCorrection).filter((c): c is Correction => !!c).reverse();
  return NextResponse.json({ corrections, updated_at: corrections[0]?.at ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; source?: string; rule?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  const { correction, mirrored } = await fileCorrection(profileIdFrom(req), { text, source: body.source, rule: body.rule });
  return NextResponse.json({ ok: true, correction, mirrored_to_library: mirrored });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { at?: string };
  if (!body.at) return NextResponse.json({ ok: false, error: "at required" }, { status: 400 });
  await updateState((s) => { s.notes = s.notes.filter((n) => parseCorrection(n)?.at !== body.at); }, profileIdFrom(req));
  return NextResponse.json({ ok: true });
}

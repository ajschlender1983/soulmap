import { NextResponse } from "next/server";
import { interviewAnswer } from "@/lib/interview";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body: `{ item_id, text, value? }`. `text` is what the person typed or said; `value` is a tapped pill
 * (1-5, 1-6, "a"/"b"/"c", or a clock "HH:MM"). Returns `{ ok, parsed, needs_clarification?, prompt?, next }`.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { item_id?: string; text?: string; value?: number | string | null };
  if (!body.item_id) return NextResponse.json({ ok: false, error: "item_id required" }, { status: 400 });
  if (!(body.text ?? "").trim() && (body.value === undefined || body.value === null)) return NextResponse.json({ ok: false, error: "text or value required" }, { status: 400 });
  const out = await interviewAnswer(profileIdFrom(req), body.item_id, body.text ?? "", body.value);
  return NextResponse.json(out, { status: out.error ? 400 : 200, headers: { "cache-control": "no-store" } });
}

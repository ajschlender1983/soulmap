import { NextResponse } from "next/server";
import { listJobs, purge, readSummary } from "@/lib/evidence";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: this person's upload jobs and, when scoring has run, the summarized evidence. DELETE: purge it all. */
export async function GET(req: Request) {
  const id = profileIdFrom(req);
  const [jobs, summary] = await Promise.all([listJobs(id), readSummary(id)]);
  return NextResponse.json({ jobs, summary });
}

export async function DELETE(req: Request) {
  try { await purge(profileIdFrom(req)); return NextResponse.json({ ok: true }); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 }); }
}

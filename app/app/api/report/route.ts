import { NextResponse } from "next/server";
import { generateReport, readReports } from "@/lib/report";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) { return NextResponse.json(await readReports(profileIdFrom(req))); }
export async function POST(req: Request) {
  try { return NextResponse.json(await generateReport(profileIdFrom(req))); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 }); }
}

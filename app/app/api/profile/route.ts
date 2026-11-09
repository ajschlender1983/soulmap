import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readState, updateState, profileDir, type Birth } from "@/lib/state";
import { purge } from "@/lib/evidence";
import { profileIdFrom, normalizeLenses, PAID_LENSES } from "@/lib/profile";
import { computeChart, geocode } from "@/lib/chart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string; email?: string; intention?: string;
  birth_time_known?: boolean;
  enabled_lenses?: string[]; // full list, or use `paid`
  paid?: Partial<Record<(typeof PAID_LENSES)[number], boolean>>; // { kolbe: true } toggles one paid lens
  consent?: boolean;
  birth?: { date: string; time?: string; place: string }; // optional here; /api/tool/record-birth does the same
};

export async function GET(req: Request) {
  const s = await readState(profileIdFrom(req));
  return NextResponse.json({ profile: s.profile, birth: s.birth, has_chart: !!s.chart, status: s.status }, { headers: { "cache-control": "no-store" } });
}

/** Onboarding fields. Partial updates are fine; only the keys present change. */
export async function POST(req: Request) {
  const id = profileIdFrom(req);
  const b = (await req.json().catch(() => ({}))) as Body;
  const s = await updateState((s) => {
    const p = s.profile;
    if (typeof b.name === "string" && b.name.trim()) p.name = b.name.trim().slice(0, 80);
    if (typeof b.email === "string") p.email = b.email.trim().slice(0, 200) || undefined;
    if (typeof b.intention === "string") p.intention = b.intention.trim().slice(0, 1000) || undefined;
    if (typeof b.birth_time_known === "boolean") p.birth_time_known = b.birth_time_known;
    if (Array.isArray(b.enabled_lenses)) p.enabled_lenses = normalizeLenses(b.enabled_lenses);
    if (b.paid && typeof b.paid === "object") {
      const set = new Set(p.enabled_lenses);
      for (const lens of PAID_LENSES) if (typeof b.paid[lens] === "boolean") { if (b.paid[lens]) set.add(lens); else set.delete(lens); }
      p.enabled_lenses = normalizeLenses([...set]);
    }
    if (b.consent === true && !p.consent_at) p.consent_at = new Date().toISOString();
    if (b.consent === false) p.consent_at = undefined;
  }, id);

  let chart_error: string | undefined;
  if (b.birth?.date && b.birth?.place) {
    try {
      const time = b.birth.time && /^\d{1,2}:\d{2}$/.test(b.birth.time) ? b.birth.time : "12:00";
      const geo = await geocode(b.birth.place);
      const birth: Birth = { date: b.birth.date, time, tz: geo.tz, place: geo.name, lat: geo.lat, lon: geo.lon, time_confidence: b.birth.time ? "exact" : "unknown" };
      const chart = await computeChart(birth);
      await updateState((st) => { st.birth = birth; st.chart = chart; st.profile.birth_time_known = !!b.birth?.time; }, id);
    } catch (err) { chart_error = err instanceof Error ? err.message : "chart failed"; }
  }
  const fresh = await readState(id);
  return NextResponse.json({ ok: true, profile: fresh.profile, birth: fresh.birth, has_chart: !!fresh.chart, chart_error });
}

/**
 * Delete everything about one person: `data/profiles/<id>` (state, uploads), `report/profiles/<id>` (both report
 * documents and the soul file) and their evidence (cache, summaries, jobs). The consent screen's "Delete everything".
 */
export async function DELETE(req: Request) {
  const id = profileIdFrom(req);
  const reportRoot = path.resolve(process.cwd(), "..", "report"); // same root lib/report.ts and lib/team.ts use
  const removed: string[] = [];
  try {
    try { await purge(id); removed.push("evidence"); } catch { /* nothing to purge */ }
    await fs.rm(profileDir(id), { recursive: true, force: true }); removed.push("profile");
    await fs.rm(path.join(reportRoot, "profiles", id), { recursive: true, force: true }); removed.push("report");
    return NextResponse.json({ ok: true, id, removed }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "delete failed", removed }, { status: 500 });
  }
}

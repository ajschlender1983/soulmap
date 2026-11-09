import { readToolArgs, toolReply } from "@/lib/tool";
import { updateState, type Birth } from "@/lib/state";
import { computeChart, geocode } from "@/lib/chart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Args = { date: string; time: string; place: string; time_confidence?: Birth["time_confidence"] };

export async function POST(req: Request) {
  const { args, profileId } = await readToolArgs<Args>(req);
  if (!args.date || !args.place) return toolReply({ ok: false, error: "date and place required" });
  const time = args.time && /^\d{1,2}:\d{2}$/.test(args.time) ? args.time : "12:00";
  try {
    const geo = await geocode(args.place);
    const birth: Birth = { date: args.date, time, tz: geo.tz, place: geo.name, lat: geo.lat, lon: geo.lon, time_confidence: args.time_confidence ?? (args.time ? "exact" : "unknown") };
    const chart = await computeChart(birth);
    await updateState((s) => { s.birth = birth; s.chart = chart; s.profile.birth_time_known = !!args.time; }, profileId);
    const c = chart as { type?: string; profile?: { value?: string }; authority?: string; strategy?: string };
    return toolReply({ ok: true, resolved_place: geo.name, timezone: geo.tz, summary: `Human Design: ${c.type ?? "?"}, profile ${c.profile?.value ?? "?"}, ${c.authority ?? "?"} authority. Strategy: ${c.strategy ?? "?"}.` });
  } catch (err) {
    return toolReply({ ok: false, error: err instanceof Error ? err.message : "chart failed" });
  }
}

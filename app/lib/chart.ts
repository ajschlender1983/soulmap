import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { Birth } from "./state";

const run = promisify(execFile);
const HDCALC_DIR = path.resolve(process.cwd(), "..", "analysis", "hdcalc");
const UV = process.env.UV_BIN ?? `${process.env.HOME}/.local/bin/uv`;

/** Free, keyless geocoder (Open-Meteo). Returns the best match with its IANA timezone. */
export async function geocode(place: string): Promise<{ name: string; lat: number; lon: number; tz: string }> {
  // Open-Meteo matches on the place name only, so "Los Angeles California" fails while
  // "Los Angeles" works. Try the full string, then the part before a comma, then
  // progressively shorter word prefixes.
  const cleaned = place.replace(/\b(usa|u\.s\.a\.|united states)\b/gi, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(",")[0].trim().split(" ");
  const candidates = Array.from(new Set([cleaned, cleaned.split(",")[0].trim(), ...words.map((_, i) => words.slice(0, words.length - i).join(" "))])).filter(Boolean);
  for (const q of candidates) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const j = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string; population?: number }[] };
    const rs = j.results ?? [];
    if (!rs.length) continue;
    // Prefer a result whose region/country text appears in what the person said.
    const lower = place.toLowerCase();
    const r = rs.find((x) => (x.admin1 && lower.includes(x.admin1.toLowerCase())) || (x.country && lower.includes(x.country.toLowerCase()))) ?? rs[0];
    return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude, tz: r.timezone };
  }
  throw new Error(`could not find a place called "${place}"`);
}

export async function computeChart(b: Birth): Promise<Record<string, unknown>> {
  // Hosted: the calculator runs as a Python serverless function next to the app.
  const chartUrl = process.env.CHART_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/chart` : null);
  if (chartUrl) {
    const res = await fetch(chartUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: b.date, time: b.time, tz: b.tz, lat: b.lat, lon: b.lon }) });
    if (!res.ok) throw new Error(`chart service ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as Record<string, unknown>;
  }
  const args = ["run", "hdcalc", "--date", b.date, "--time", b.time, "--tz", b.tz, "--lat", String(b.lat), "--lon", String(b.lon)];
  const { stdout } = await run(UV, args, { cwd: HDCALC_DIR, maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout) as Record<string, unknown>;
}

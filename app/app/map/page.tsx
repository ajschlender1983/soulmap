"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useHref } from "@/components/api";
import { SoulMap, type Live, type MapRegion } from "@/components/SoulMap";
import { MapDetails } from "@/components/MapDetails";
import { ArrowLeft } from "@/components/Icons";

const EMPTY: Live = { progress: { enneagram: 0, attachment: 0, kolbe: 0, birth: 0 }, enneagram: null, attachment: null, kolbe: null, chart: null };

/** The full map. Below 400px the SVG hides its corners and the cards below carry that detail. */
export default function MapPage() {
  const h = useHref();
  const [live, setLive] = useState<Live>(EMPTY);
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    const j = await api<Live & { status?: string }>("/api/map");
    if (j._status === 200) { setLive(j); setStatus(j.status ?? ""); }
  }, []);
  useEffect(() => { load(); const id = window.setInterval(load, 5000); return () => window.clearInterval(id); }, [load]);

  const jump = (r: MapRegion) => {
    const el = document.getElementById(`map-${r}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); }
    else if (status === "complete" || status === "reported") window.location.assign(h(`/report#${r}`));
  };

  return (
    <main className="mx-auto max-w-5xl md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:gap-8 md:px-8">
      <header className="gutter flex items-center gap-2 pt-[max(8px,env(safe-area-inset-top))] md:col-span-2">
        <a className="icon-btn" href={h("/")} aria-label="Back"><ArrowLeft /></a>
        <h1 className="text-[var(--text-h2)]">Your map</h1>
      </header>
      <section className="gutter pt-2">
        <div className="mx-auto aspect-square w-full max-w-[min(92vw,80vh)]"><SoulMap live={live} onRegion={jump} /></div>
        <p className="t-caption muted mt-2 text-center">Tap a region for its detail.</p>
      </section>
      <section className="gutter safe-bottom pt-4">
        <MapDetails live={live} />
        {(status === "complete" || status === "reported") && <a className="btn btn-primary btn-block mt-4" href={h("/report")}>Read the report</a>}
      </section>
    </main>
  );
}

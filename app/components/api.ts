"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Person-aware fetch. The UI never asks for a login: the person comes from `?p=` on the page URL
 * (kept across navigation) or defaults server-side. We forward it as both `?p=` and `x-person`.
 */
/** Where the app is mounted ("/soul" behind Recall). Prefixed on every API call and link. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const HOSTED = process.env.NEXT_PUBLIC_HOSTED === "1";

export function personId(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("p");
  if (p && /^[a-z0-9][a-z0-9_-]{0,39}$/i.test(p)) return p.toLowerCase();
  if (!HOSTED) return null;
  // Hosted demo: no private network to identify the person, so each browser gets its own profile.
  try {
    let id = localStorage.getItem("soul_p");
    if (!id) { id = "u" + Math.random().toString(36).slice(2, 12); localStorage.setItem("soul_p", id); }
    return id;
  } catch { return null; }
}

/** Append the current `?p=` to an internal href so navigation keeps the identity. */
export function href(path: string): string {
  const p = personId();
  const full = BASE + path;
  if (!p) return full;
  return full + (full.includes("?") ? "&" : "?") + "p=" + encodeURIComponent(p);
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T & { _status: number }> {
  const p = personId();
  const base = BASE + path;
  const url = p ? base + (base.includes("?") ? "&" : "?") + "p=" + encodeURIComponent(p) : base;
  const headers = new Headers(init?.headers);
  if (p) headers.set("x-person", p);
  let body = init?.body;
  if (init && "json" in init && init.json !== undefined) { headers.set("content-type", "application/json"); body = JSON.stringify(init.json); }
  const r = await fetch(url, { ...init, headers, body, cache: "no-store" });
  let data: unknown = {};
  try { data = await r.json(); } catch { /* empty body */ }
  return Object.assign({}, data as T, { _status: r.status });
}

/** Hydration-safe `href`: on the server and first paint it is the bare path; after mount it carries `?p=`. */
export function useHref(): (path: string) => string {
  const [p, setP] = useState<string | null>(null);
  useEffect(() => { setP(personId()); }, []);
  return useCallback((path: string) => { const full = BASE + path; return p ? full + (full.includes("?") ? "&" : "?") + "p=" + encodeURIComponent(p) : full; }, [p]);
}

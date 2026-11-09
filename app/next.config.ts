import type { NextConfig } from "next";

// The app is served behind Recall's private-network door at <recall address>/soul.
// Locally it is also reachable at http://localhost:3355/soul (dev: http://localhost:3000/soul).
// SOUL_BASE_PATH="" for a hosted deployment at the domain root.
const RAW = process.env.SOUL_BASE_PATH;
const BASE = RAW === undefined ? "/soul" : RAW === "/" ? "" : RAW;

const nextConfig: NextConfig = {
  reactStrictMode: false,
  ...(BASE ? { basePath: BASE } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: BASE, NEXT_PUBLIC_HOSTED: process.env.VERCEL ? "1" : "" },
};

export default nextConfig;

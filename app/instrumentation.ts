/** Starts the daily connector sync when the server boots (Mac install only; lib/autosync.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PUBLIC_HOSTED === "1" || process.env.SOUL_NO_AUTOSYNC) return;
  const { startAutoSync } = await import("./lib/autosync");
  startAutoSync();
}

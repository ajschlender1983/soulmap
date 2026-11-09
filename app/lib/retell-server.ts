import Retell from "retell-sdk";

let cached: Retell | null = null;

export function retell(): Retell {
  if (cached) return cached;
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("Missing RETELL_API_KEY");
  cached = new Retell({ apiKey });
  return cached;
}

export type CallData = {
  agentId: string | null;
  transcript: string | null;
  recordingUrl: string | null;
};

/**
 * Pull the agent id, transcript, and recording URL from a Retell call.
 * transcript is null if it isn't ready yet (call still processing) or if the
 * call has no transcript field.
 */
export async function fetchCallData(callId: string): Promise<CallData> {
  const call = await retell().call.retrieve(callId);
  const a =
    "agent_id" in call && typeof call.agent_id === "string"
      ? call.agent_id
      : null;
  const t =
    "transcript" in call && typeof call.transcript === "string"
      ? call.transcript
      : null;
  const r =
    "recording_url" in call && typeof call.recording_url === "string"
      ? call.recording_url
      : null;
  return {
    agentId: a,
    transcript: t && t.trim().length > 0 ? t : null,
    recordingUrl: r && r.length > 0 ? r : null,
  };
}


/** Thin raw client for endpoints the SDK does not wrap (chat). */
export async function retellFetch<T = unknown>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("Missing RETELL_API_KEY");
  const res = await fetch("https://api.retellai.com" + path, {
    method,
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`retell ${path} ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

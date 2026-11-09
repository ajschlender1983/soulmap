import { NextResponse } from "next/server";
import { profileIdFrom, sanitizeProfileId } from "./profile";

/**
 * Retell custom-function payload: { call, name, args }. The person is resolved from, in order: an explicit
 * `args.profile_id`, the call's dynamic variable `profile_id` (set by dynamicVars), then `?p=` / `x-person`.
 */
export async function readToolArgs<T>(req: Request): Promise<{ args: T; callId: string | null; profileId: string }> {
  const body = (await req.json().catch(() => ({}))) as {
    call?: { call_id?: string; retell_llm_dynamic_variables?: Record<string, string>; metadata?: Record<string, string> };
    args?: (T & { profile_id?: string }) | undefined;
    name?: string;
  };
  const args = (body.args ?? ({} as T & { profile_id?: string }));
  const profileId = sanitizeProfileId(args.profile_id) ?? sanitizeProfileId(body.call?.retell_llm_dynamic_variables?.profile_id) ?? sanitizeProfileId(body.call?.metadata?.profile_id) ?? profileIdFrom(req);
  return { args: args as T, callId: body.call?.call_id ?? null, profileId };
}

/** Retell reads whatever we return and hands it to the LLM as the tool result. */
export function toolReply(result: unknown) {
  return NextResponse.json(result);
}

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ConfigError } from "@/lib/supabase/env";
import { RateLimitError } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the signed-in user for an API route, or a 401 response. */
export async function routeUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export function handleRouteError(e: unknown, context: string) {
  if (e instanceof RateLimitError) return jsonError(e.message, 429);
  if (e instanceof ConfigError) return jsonError(e.message, 503);
  if ((e as Error)?.name === "UserFacingError") return jsonError((e as Error).message, 400);
  log.error(`${context} failed`, { error: (e as Error)?.message });
  return jsonError("Something went wrong. Please try again.", 500);
}

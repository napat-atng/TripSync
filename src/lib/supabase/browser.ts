import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

export function createBrowserSupabaseClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error("Supabase environment variables are missing");
  return createBrowserClient(env.url, env.key);
}

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "./database.types";

const environment = z.object({
  url: z.url(),
  key: z.string().min(1),
}).safeParse({ url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY });

export const configurationError = environment.success ? null : "ยังไม่ได้ตั้งค่าการเชื่อมต่อ TripSync กรุณาตรวจ environment ของเว็บไซต์";
export const supabase = environment.success ? createClient<Database, "tripsync">(
  environment.data.url, environment.data.key, {
    db: { schema: "tripsync" },
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storageKey: "tripsync-web-auth" },
  },
) : null;

export function getSupabase() {
  if (!supabase) throw new Error(configurationError ?? "การเชื่อมต่อไม่พร้อมใช้งาน");
  return supabase;
}

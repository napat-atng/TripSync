"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) redirect("/notifications?error=read");
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fnotifications");
  const { error } = await supabase.from("notification_reads").upsert({
    event_id: eventId, user_id: auth.claims.sub,
  }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  if (error) redirect("/notifications?error=read");
  revalidatePath("/notifications");
  redirect("/notifications");
}

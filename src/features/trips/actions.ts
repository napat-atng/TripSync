"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createTrip(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deadlineLocal = String(formData.get("deadlineLocal") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) redirect("/groups");
  if (!title || title.length > 160
      || description.length > 1000 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadlineLocal)) {
    redirect(`/groups/${groupId}?error=trip`);
  }

  // The form labels this as Bangkok time, independent of the organizer's device timezone.
  const deadline = new Date(`${deadlineLocal}:00+07:00`);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    redirect(`/groups/${groupId}?error=deadline`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: membership } = await supabase.from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!membership) redirect(`/groups/${groupId}`);

  const { data: trip, error } = await supabase.from("trips").insert({
    group_id: groupId,
    organizer_id: auth.claims.sub,
    title,
    description,
    vote_deadline: deadline.toISOString(),
    timezone: "Asia/Bangkok",
  }).select("id").single();
  if (error || !trip) redirect(`/groups/${groupId}?error=trip`);
  redirect(`/trips/${trip.id}`);
}

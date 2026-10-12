"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidTimeZone, parseZonedInput } from "./time";

export async function createTrip(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deadlineLocal = String(formData.get("deadlineLocal") ?? "");
  const timezone = String(formData.get("timezone") ?? "Asia/Bangkok").trim();
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) redirect("/groups");
  if (!title || title.length > 160
      || description.length > 1000 || !isValidTimeZone(timezone)) {
    redirect(`/groups/${groupId}?error=trip`);
  }

  const deadline = parseZonedInput(deadlineLocal, timezone);
  if (!deadline || deadline.getTime() <= Date.now()) {
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
    timezone,
  }).select("id").single();
  if (error || !trip) redirect(`/groups/${groupId}?error=trip`);
  redirect(`/trips/${trip.id}`);
}

export async function editDraftTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const deadlineLocal = String(formData.get("deadlineLocal") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/groups");
  if (!title || title.length > 160 || description.length > 1000) {
    redirect(`/trips/${tripId}?error=edit`);
  }
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/trips/${tripId}`)}`);
  }
  const { data: trip } = await supabase.from("trips")
    .select("organizer_id, status, timezone").eq("id", tripId).maybeSingle();
  if (!trip || trip.organizer_id !== auth.claims.sub || trip.status !== "draft") {
    redirect(`/trips/${tripId}?error=edit`);
  }
  const deadline = parseZonedInput(deadlineLocal, trip.timezone);
  if (!deadline || deadline.getTime() <= Date.now()) {
    redirect(`/trips/${tripId}?error=edit`);
  }
  const { data: updated, error } = await supabase.from("trips")
    .update({ title, description, vote_deadline: deadline.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", tripId).eq("status", "draft").select("id").maybeSingle();
  if (error || !updated) redirect(`/trips/${tripId}?error=edit`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function validId(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function addTripParticipant(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!validId(tripId) || !validId(userId)) redirect("/groups");

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: trip } = await supabase.from("trips")
    .select("group_id, organizer_id, status")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.organizer_id !== auth.claims.sub || trip.status !== "draft") {
    redirect(`/trips/${tripId}?error=participant`);
  }
  const { data: member } = await supabase.from("group_members")
    .select("user_id")
    .eq("group_id", trip.group_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) redirect(`/trips/${tripId}?error=participant`);

  const { error } = await supabase.from("trip_participants").insert({
    trip_id: tripId,
    user_id: userId,
    invitation_status: "pending",
  });
  if (error) redirect(`/trips/${tripId}?error=participant`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function removeTripParticipant(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!validId(tripId) || !validId(userId)) redirect("/groups");

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: trip } = await supabase.from("trips")
    .select("organizer_id, status")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.organizer_id !== auth.claims.sub || trip.status !== "draft"
      || userId === auth.claims.sub) {
    redirect(`/trips/${tripId}?error=participant`);
  }

  const { data, error } = await supabase.from("trip_participants")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) redirect(`/trips/${tripId}?error=participant`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function respondToTripInvitation(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!validId(tripId) || !["interested", "declined"].includes(status)) redirect("/groups");
  if (status === "declined" && formData.get("confirmDecline") !== "yes") {
    redirect(`/trips/${tripId}?error=response`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { error } = await supabase.rpc("respond_to_trip_invitation", {
    p_trip_id: tripId, p_status: status,
  });
  if (error) redirect(`/trips/${tripId}?error=response`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

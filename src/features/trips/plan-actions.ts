"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseZonedInput } from "./time";

async function context(tripId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/groups");
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: trip } = await supabase.from("trips")
    .select("id, group_id, organizer_id, title, status, vote_deadline, timezone")
    .eq("id", tripId).maybeSingle();
  if (!trip) redirect("/groups");
  return { supabase, userId: auth.claims.sub, trip };
}

function finish(tripId: string): never {
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function savePlan(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const dateId = String(formData.get("dateId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  const meetingLocal = String(formData.get("meetingLocal") ?? "");
  const meetingPoint = String(formData.get("meetingPoint") ?? "").trim();
  const { supabase, userId, trip } = await context(tripId);
  if (trip.organizer_id !== userId || !["confirm", "change"].includes(mode)
      || (mode === "confirm" && (trip.status !== "voting" || new Date(trip.vote_deadline).getTime() > Date.now()))
      || (mode === "change" && trip.status !== "confirmed")
      || !/^[0-9a-f-]{36}$/i.test(dateId) || !/^[0-9a-f-]{36}$/i.test(placeId)
      || !meetingPoint || meetingPoint.length > 500) {
    redirect(`/trips/${tripId}?error=plan`);
  }
  const meetingAt = parseZonedInput(meetingLocal, trip.timezone);
  if (!meetingAt || meetingAt.getTime() <= Date.now()) {
    redirect(`/trips/${tripId}?error=plan`);
  }
  const { data: dateOption } = await supabase.from("date_options")
    .select("id, starts_on, ends_on").eq("id", dateId).eq("trip_id", tripId).maybeSingle();
  const { data: placeOption } = await supabase.from("place_options")
    .select("id").eq("id", placeId).eq("trip_id", tripId).maybeSingle();
  const meetingDate = meetingLocal.slice(0, 10);
  if (!dateOption || !placeOption || meetingDate < dateOption.starts_on
      || meetingDate > dateOption.ends_on) redirect(`/trips/${tripId}?error=plan`);

  const rpc = mode === "confirm" ? "confirm_trip" : "change_plan";
  const { error } = await supabase.rpc(rpc, {
    p_trip_id: tripId,
    p_date_id: dateId,
    p_place_id: placeId,
    p_meeting_at: meetingAt.toISOString(),
    p_meeting_point: meetingPoint,
  });
  if (error) redirect(`/trips/${tripId}?error=plan`);
  finish(tripId);
}

export async function submitRsvp(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const response = String(formData.get("response") ?? "");
  const { supabase, userId, trip } = await context(tripId);
  if (trip.status !== "confirmed" || !["going", "maybe", "not_going"].includes(response)) {
    redirect(`/trips/${tripId}?error=rsvp`);
  }
  const { data: participant } = await supabase.from("trip_participants")
    .select("invitation_status").eq("trip_id", tripId).eq("user_id", userId).maybeSingle();
  if (!participant || participant.invitation_status === "declined") {
    redirect(`/trips/${tripId}?error=rsvp`);
  }
  const { error } = await supabase.rpc("submit_rsvp", {
    p_trip_id: tripId, p_response: response,
  });
  if (error) redirect(`/trips/${tripId}?error=rsvp`);
  finish(tripId);
}

export async function cancelTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const { supabase, userId, trip } = await context(tripId);
  if (formData.get("confirmCancel") !== "yes"
      || trip.organizer_id !== userId || !["draft", "voting", "confirmed"].includes(trip.status)
      || reason.length > 500) redirect(`/trips/${tripId}?error=cancel`);
  const { error } = await supabase.rpc("cancel_trip", { p_trip_id: tripId, p_reason: reason });
  if (error) redirect(`/trips/${tripId}?error=cancel`);
  finish(tripId);
}

export async function deleteTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const { supabase, userId, trip } = await context(tripId);
  if (trip.organizer_id !== userId || confirmation !== trip.title
      || !["draft", "cancelled", "completed"].includes(trip.status)) {
    redirect(`/trips/${tripId}?error=delete`);
  }
  const { error } = await supabase.rpc("delete_trip", { p_trip_id: tripId });
  if (error) redirect(`/trips/${tripId}?error=delete`);
  revalidatePath(`/groups/${trip.group_id}`);
  revalidatePath("/groups");
  redirect(`/groups/${trip.group_id}`);
}

export async function completeTrip(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase, userId, trip } = await context(tripId);
  if (trip.organizer_id !== userId || trip.status !== "confirmed") {
    redirect(`/trips/${tripId}?error=complete`);
  }
  const { error } = await supabase.rpc("complete_trip", { p_trip_id: tripId });
  if (error) redirect(`/trips/${tripId}?error=complete`);
  finish(tripId);
}

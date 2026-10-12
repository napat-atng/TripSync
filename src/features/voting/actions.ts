"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function tripContext(tripId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/groups");
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: trip } = await supabase.from("trips")
    .select("id, group_id, organizer_id, status, vote_deadline")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) redirect("/groups");
  const { data: participant } = await supabase.from("trip_participants")
    .select("invitation_status")
    .eq("trip_id", tripId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  return { supabase, userId: auth.claims.sub, trip, participant };
}

function done(tripId: string): never {
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function addDateOption(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  const { supabase, userId, trip, participant } = await tripContext(tripId);
  if (trip.status !== "draft" || !participant || participant.invitation_status === "declined"
      || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)
      || endsOn < startsOn) redirect(`/trips/${tripId}?error=date-option`);
  const { error } = await supabase.from("date_options").insert({
    trip_id: tripId, starts_on: startsOn, ends_on: endsOn, created_by: userId,
  });
  if (error) redirect(`/trips/${tripId}?error=date-option`);
  done(tripId);
}

export async function addPlaceOption(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const mapUrl = String(formData.get("mapUrl") ?? "").trim();
  const { supabase, userId, trip, participant } = await tripContext(tripId);
  if (trip.status !== "draft" || !participant || participant.invitation_status === "declined"
      || !name || name.length > 160 || address.length > 500 || mapUrl.length > 1000) {
    redirect(`/trips/${tripId}?error=place-option`);
  }
  if (mapUrl) {
    try {
      const url = new URL(mapUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
    } catch {
      redirect(`/trips/${tripId}?error=place-option`);
    }
  }
  const { error } = await supabase.from("place_options").insert({
    trip_id: tripId, name, address: address || null, map_url: mapUrl || null, created_by: userId,
  });
  if (error) redirect(`/trips/${tripId}?error=place-option`);
  done(tripId);
}

export async function removeOption(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const { supabase, userId, trip } = await tripContext(tripId);
  if (!/^[0-9a-f-]{36}$/i.test(optionId) || trip.organizer_id !== userId
      || trip.status !== "draft" || !["date", "place"].includes(kind)) {
    redirect(`/trips/${tripId}?error=option`);
  }
  const table = kind === "date" ? "date_options" : "place_options";
  const { data, error } = await supabase.from(table)
    .delete().eq("id", optionId).eq("trip_id", tripId).select("id");
  if (error || !data?.length) redirect(`/trips/${tripId}?error=option`);
  done(tripId);
}

export async function editDateOption(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  const { supabase, userId, trip } = await tripContext(tripId);
  if (!/^[0-9a-f-]{36}$/i.test(optionId) || trip.organizer_id !== userId
      || trip.status !== "draft" || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)
      || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || endsOn < startsOn) {
    redirect(`/trips/${tripId}?error=date-option`);
  }
  const { data, error } = await supabase.from("date_options")
    .update({ starts_on: startsOn, ends_on: endsOn })
    .eq("id", optionId).eq("trip_id", tripId).select("id");
  if (error || !data?.length) redirect(`/trips/${tripId}?error=date-option`);
  done(tripId);
}

export async function editPlaceOption(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const mapUrl = String(formData.get("mapUrl") ?? "").trim();
  const { supabase, userId, trip } = await tripContext(tripId);
  if (!/^[0-9a-f-]{36}$/i.test(optionId) || trip.organizer_id !== userId
      || trip.status !== "draft" || !name || name.length > 160
      || address.length > 500 || mapUrl.length > 1000) {
    redirect(`/trips/${tripId}?error=place-option`);
  }
  if (mapUrl) {
    try {
      const url = new URL(mapUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
    } catch {
      redirect(`/trips/${tripId}?error=place-option`);
    }
  }
  const { data, error } = await supabase.from("place_options")
    .update({ name, address: address || null, map_url: mapUrl || null })
    .eq("id", optionId).eq("trip_id", tripId).select("id");
  if (error || !data?.length) redirect(`/trips/${tripId}?error=place-option`);
  done(tripId);
}

export async function openVoting(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase, userId, trip } = await tripContext(tripId);
  if (trip.organizer_id !== userId || trip.status !== "draft") {
    redirect(`/trips/${tripId}?error=open`);
  }
  const { error } = await supabase.rpc("open_voting", { p_trip_id: tripId });
  if (error) redirect(`/trips/${tripId}?error=open`);
  done(tripId);
}

async function voteContext(tripId: string) {
  const context = await tripContext(tripId);
  if (context.trip.status !== "voting"
      || new Date(context.trip.vote_deadline).getTime() <= Date.now()
      || !context.participant || context.participant.invitation_status === "declined") {
    redirect(`/trips/${tripId}?error=voting-closed`);
  }
  return context;
}

export async function submitDateVotes(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await voteContext(tripId);
  const { data: options, error: optionsError } = await supabase.from("date_options")
    .select("id").eq("trip_id", tripId);
  if (optionsError || !options?.length) redirect(`/trips/${tripId}?error=date-vote`);
  const votes = options.map((option) => ({
    option_id: option.id,
    response: String(formData.get(`date-${option.id}`) ?? ""),
  }));
  if (votes.some((vote) => !["available", "maybe", "unavailable"].includes(vote.response))) {
    redirect(`/trips/${tripId}?error=date-vote`);
  }
  const { error } = await supabase.rpc("submit_date_votes", { p_trip_id: tripId, p_votes: votes });
  if (error) redirect(`/trips/${tripId}?error=date-vote`);
  done(tripId);
}

export async function submitPlaceVotes(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const { supabase } = await voteContext(tripId);
  const placeIds = formData.getAll("placeId").map(String);
  if (placeIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    redirect(`/trips/${tripId}?error=place-vote`);
  }
  const { error } = await supabase.rpc("submit_place_votes", {
    p_trip_id: tripId,
    p_place_ids: placeIds,
  });
  if (error) redirect(`/trips/${tripId}?error=place-vote`);
  done(tripId);
}

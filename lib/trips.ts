import { supabase } from "./supabase";
import type { Trip } from "../types/trip";

export async function createTrip(
  name: string,
  description: string | null,
  userId: string,
  displayName: string | null,
) {
  // invite_token is generated server-side by the `set_trip_invite_token`
  // trigger (see migration 20260605184500). Don't send it from the client —
  // sending an empty/null value lets the trigger populate a unique token.
  const { data: tripData, error: tripError } = await (supabase as any)
    .from("trips")
    .insert([
      {
        name,
        description,
        created_by: userId,
      },
    ])
    .select()
    .single();

  if (tripError) {
    throw tripError;
  }

  // 2. Insert into trip_members as leader
  const { error: memberError } = await (supabase as any).from("trip_members").insert([
    {
      trip_id: tripData.id,
      user_id: userId,
      display_name: displayName,
      role: "leader",
    },
  ]);

  if (memberError) {
    throw memberError;
  }

  return tripData as Trip;
}

export async function getUserTrips(userId: string) {
  // Query trips joined with trip_members where user_id matches
  const { data, error } = await (supabase as any)
    .from("trips")
    .select(
      `
      *,
      trip_members!inner(id, user_id, role)
    `,
    )
    .eq("trip_members.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as unknown as Trip[];
}

export async function setConfirmedDate(tripId: string, date: string) {
  const { data, error } = await (supabase as any)
    .from("trips")
    .update({ confirmed_date: date })
    .eq("id", tripId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Trip;
}

export async function getTripByInviteToken(token: string) {
  const { data, error } = await (supabase as any)
    .from("trips")
    .select("*")
    .eq("invite_token", token)
    .single();

  if (error) {
    throw error;
  }

  return data as Trip;
}

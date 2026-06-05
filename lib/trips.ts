import { supabase } from "./supabase";
import type { Trip } from "../types/trip";

// Fallback random string generator since crypto.randomUUID isn't always available in React Native without polyfills
function generateInviteToken() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export async function createTrip(name: string, description: string | null, userId: string) {
  const inviteToken = generateInviteToken();

  // 1. Insert into trips
  const { data: tripData, error: tripError } = await (supabase as any)
    .from("trips")
    .insert([
      {
        name,
        description,
        invite_token: inviteToken,
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
  // Supabase postgREST syntax for joining:
  // We want to fetch from trips, but filter by the related trip_members table
  const { data, error } = await (supabase as any)
    .from("trips")
    .select(`
      *,
      trip_members!inner(user_id)
    `)
    .eq("trip_members.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as unknown as Trip[];
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

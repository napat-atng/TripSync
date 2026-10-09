import { supabase } from "./supabase";
import type { TripMember } from "../types/trip";

export async function joinTripAsUser(tripId: string, userId: string, displayName: string | null) {
  // Check if already a member
  const { data: existing } = await (supabase as any)
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .single();

  if (existing) {
    return existing as TripMember;
  }

  const { data, error } = await (supabase as any)
    .from("trip_members")
    .insert([
      {
        trip_id: tripId,
        user_id: userId,
        display_name: displayName,
        role: "member",
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TripMember;
}

export async function joinTripAsGuest(tripId: string, displayName: string) {
  const { data, error } = await (supabase as any)
    .from("trip_members")
    .insert([
      {
        trip_id: tripId,
        user_id: null,
        display_name: displayName,
        role: "member",
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TripMember;
}

export async function getMembersByTrip(tripId: string) {
  const { data, error } = await (supabase as any)
    .from("trip_members")
    .select("*")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as TripMember[];
}

import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getMyMemberId(tripId: string, userId?: string | null) {
  if (userId) {
    const { data } = await (supabase as any)
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .single();
    return data?.id as string | undefined;
  } else {
    const existingStr = await AsyncStorage.getItem("guest_memberships");
    if (existingStr) {
      const memberships = JSON.parse(existingStr);
      return memberships[tripId] as string | undefined;
    }
  }
  return undefined;
}

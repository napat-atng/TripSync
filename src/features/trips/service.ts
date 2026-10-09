import { getSupabase } from "../../shared/supabase";
import { tripInput, type TripInput } from "./validation";

export async function listTrips() {
  const { data, error } = await getSupabase().from("trips").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function getTrip(id: string) {
  const { data, error } = await getSupabase().from("trips").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function createTrip(input: TripInput) {
  const value = tripInput.parse(input);
  const { data, error } = await getSupabase().rpc("create_trip", {
    p_name: value.name, p_description: value.description, p_timezone: value.timezone, p_join_mode: value.joinMode,
  });
  if (error) throw error;
  return data;
}

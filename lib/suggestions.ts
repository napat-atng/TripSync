import { supabase } from "./supabase";
import type { SuggestionsResult } from "../types/suggestion";

/**
 * Call the suggest-destinations Edge Function.
 * The function fetches all survey + availability data server-side,
 * calls Claude, and returns 3 destination suggestions.
 */
export async function generateSuggestions(tripId: string): Promise<SuggestionsResult> {
  const { data, error } = await (supabase as any).functions.invoke("suggest-destinations", {
    body: { tripId },
  });

  if (error) throw error;
  if (!data?.suggestions) throw new Error("No suggestions returned from AI.");

  return data as SuggestionsResult;
}

/**
 * Load previously saved suggestions from trips.ai_suggestions (cached).
 * Returns null if no suggestions have been generated yet.
 */
export async function getSavedSuggestions(tripId: string): Promise<SuggestionsResult | null> {
  const { data, error } = await (supabase as any)
    .from("trips")
    .select("ai_suggestions")
    .eq("id", tripId)
    .single();

  if (error) throw error;
  if (!data?.ai_suggestions) return null;

  return {
    suggestions: data.ai_suggestions,
    generated_at: "",
    trip_id: tripId,
  };
}

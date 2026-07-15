import { supabase } from "./supabase";
import type { TripComment } from "../types/comment";

// itineraryEventId omitted/null -> general trip discussion thread
export async function getCommentsByTrip(
  tripId: string,
  itineraryEventId: string | null = null,
): Promise<TripComment[]> {
  let query = (supabase as any)
    .from("trip_comments")
    .select(
      `
      *,
      trip_members(display_name)
    `,
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  query = itineraryEventId ? query.eq("itinerary_event_id", itineraryEventId) : query.is("itinerary_event_id", null);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(mapComment);
}

export async function addComment(
  tripId: string,
  memberId: string,
  message: string,
  itineraryEventId: string | null = null,
): Promise<TripComment> {
  const { data, error } = await (supabase as any)
    .from("trip_comments")
    .insert([
      {
        trip_id: tripId,
        itinerary_event_id: itineraryEventId,
        member_id: memberId,
        message: message.trim(),
      },
    ])
    .select(
      `
      *,
      trip_members(display_name)
    `,
    )
    .single();

  if (error) throw error;
  return mapComment(data);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await (supabase as any).from("trip_comments").delete().eq("id", commentId);
  if (error) throw error;
}

function mapComment(c: any): TripComment {
  return {
    id: c.id,
    trip_id: c.trip_id,
    itinerary_event_id: c.itinerary_event_id,
    member_id: c.member_id,
    message: c.message,
    created_at: c.created_at,
    display_name: c.trip_members?.display_name ?? null,
  };
}

// ----------------------------------------------------------------
// Realtime: fires on every insert/delete so the chat thread updates
// live across devices without a manual refresh.
// itineraryEventId: pass the same scope you loaded with getCommentsByTrip,
// so a general-thread subscriber isn't re-fetching on unrelated event comments.
// ----------------------------------------------------------------
export function subscribeToComments(
  tripId: string,
  onChange: () => void,
  itineraryEventId: string | null = null,
): () => void {
  const filter = itineraryEventId
    ? `itinerary_event_id=eq.${itineraryEventId}`
    : `trip_id=eq.${tripId}`;

  const channel = (supabase as any)
    .channel(`trip_comments:${tripId}:${itineraryEventId ?? "general"}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "trip_comments", filter }, () => onChange())
    .subscribe();

  return () => {
    (supabase as any).removeChannel(channel);
  };
}

import { supabase } from "./supabase";
import type { AddItineraryEventInput, ItineraryDay, ItineraryEvent } from "../types/itinerary";
import type { Trip } from "../types/trip";

// ----------------------------------------------------------------
// Fetch all itinerary events for a trip (flat list, sorted)
// ----------------------------------------------------------------
export async function getItineraryByTrip(tripId: string): Promise<ItineraryEvent[]> {
  const { data, error } = await (supabase as any)
    .from("itinerary_events")
    .select("*")
    .eq("trip_id", tripId)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ItineraryEvent[];
}

export async function addItineraryEvent(
  tripId: string,
  createdByMemberId: string,
  input: AddItineraryEventInput,
): Promise<ItineraryEvent> {
  const { data, error } = await (supabase as any)
    .from("itinerary_events")
    .insert([
      {
        trip_id: tripId,
        event_date: input.eventDate,
        title: input.title,
        description: input.description ?? null,
        start_time: normalizeTime(input.startTime),
        end_time: input.endTime ? normalizeTime(input.endTime) : null,
        location: input.location ?? null,
        cost_estimate: input.costEstimate ?? null,
        created_by: createdByMemberId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as ItineraryEvent;
}

export async function updateItineraryEvent(
  eventId: string,
  input: Partial<AddItineraryEventInput>,
): Promise<ItineraryEvent> {
  const payload: Record<string, unknown> = {};
  if (input.eventDate !== undefined) payload.event_date = input.eventDate;
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.startTime !== undefined) payload.start_time = normalizeTime(input.startTime);
  if (input.endTime !== undefined) payload.end_time = input.endTime ? normalizeTime(input.endTime) : null;
  if (input.location !== undefined) payload.location = input.location;
  if (input.costEstimate !== undefined) payload.cost_estimate = input.costEstimate;

  const { data, error } = await (supabase as any)
    .from("itinerary_events")
    .update(payload)
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw error;
  return data as ItineraryEvent;
}

export async function deleteItineraryEvent(eventId: string): Promise<void> {
  const { error } = await (supabase as any).from("itinerary_events").delete().eq("id", eventId);
  if (error) throw error;
}

// ----------------------------------------------------------------
// Trip duration (leader-only, same RLS path as setConfirmedDate)
// ----------------------------------------------------------------
export async function setTripDuration(tripId: string, durationDays: number): Promise<Trip> {
  const { data, error } = await (supabase as any)
    .from("trips")
    .update({ duration_days: durationDays })
    .eq("id", tripId)
    .select()
    .single();

  if (error) throw error;
  return data as Trip;
}

// ----------------------------------------------------------------
// Group a flat list of events into day buckets, starting at
// confirmedDate and running for durationDays days.
// ----------------------------------------------------------------
export function buildItineraryDays(
  confirmedDate: string,
  durationDays: number,
  events: ItineraryEvent[],
): ItineraryDay[] {
  const days: ItineraryDay[] = [];
  for (let i = 0; i < durationDays; i++) {
    const date = addDays(confirmedDate, i);
    days.push({
      dayNumber: i + 1,
      date,
      events: events
        .filter((e) => e.event_date === date)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    });
  }
  return days;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Accepts "HH:mm" or "HH:mm:ss" and returns "HH:mm:ss" for Postgres `time`
function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

// ----------------------------------------------------------------
// Realtime: refresh whenever itinerary_events change for this trip
// ----------------------------------------------------------------
export function subscribeToItineraryEvents(tripId: string, onChange: () => void): () => void {
  const channel = (supabase as any)
    .channel(`itinerary_events:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "itinerary_events", filter: `trip_id=eq.${tripId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    (supabase as any).removeChannel(channel);
  };
}

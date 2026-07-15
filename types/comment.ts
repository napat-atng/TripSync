export interface TripComment {
  id: string;
  trip_id: string;
  itinerary_event_id: string | null;
  member_id: string;
  message: string;
  created_at: string;
  display_name: string | null;
}

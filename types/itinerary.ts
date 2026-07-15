export interface ItineraryEvent {
  id: string;
  trip_id: string;
  event_date: string; // "YYYY-MM-DD"
  title: string;
  description: string | null;
  start_time: string; // "HH:mm:ss"
  end_time: string | null; // "HH:mm:ss"
  location: string | null;
  cost_estimate: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItineraryDay {
  dayNumber: number; // 1-indexed
  date: string; // "YYYY-MM-DD"
  events: ItineraryEvent[];
}

export interface AddItineraryEventInput {
  eventDate: string;
  title: string;
  description?: string | null;
  startTime: string; // "HH:mm"
  endTime?: string | null; // "HH:mm"
  location?: string | null;
  costEstimate?: number | null;
}

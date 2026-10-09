export interface Availability {
  id: string;
  trip_id: string;
  member_id: string;
  date: string; // ISO date string: "YYYY-MM-DD"
  available: boolean;
}

export interface AvailabilityWithMember extends Availability {
  display_name: string | null;
}

export interface DayAvailability {
  date: string;
  count: number;
  total: number;
  members: { member_id: string; display_name: string | null }[];
}

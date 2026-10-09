export interface TripTask {
  id: string;
  trip_id: string;
  title: string;
  is_completed: boolean;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  assigned_to_name?: string | null;
}

import { supabase } from "./supabase";
import type { TripTask } from "../types/task";

export async function getTasksByTrip(tripId: string): Promise<TripTask[]> {
  const { data, error } = await (supabase as any)
    .from("trip_tasks")
    .select(
      `
      *,
      trip_members!trip_tasks_assigned_to_fkey(display_name)
    `,
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function addTask(
  tripId: string,
  createdByMemberId: string,
  title: string,
  assignedTo: string | null = null,
): Promise<TripTask> {
  const { data, error } = await (supabase as any)
    .from("trip_tasks")
    .insert([
      {
        trip_id: tripId,
        title: title.trim(),
        assigned_to: assignedTo,
        created_by: createdByMemberId,
      },
    ])
    .select(
      `
      *,
      trip_members!trip_tasks_assigned_to_fkey(display_name)
    `,
    )
    .single();

  if (error) {
    console.error("[addTask] Supabase error:", error);
    throw error;
  }
  return mapTask(data);
}

export async function toggleTaskCompletion(taskId: string, isCompleted: boolean): Promise<void> {
  const { error } = await (supabase as any)
    .from("trip_tasks")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) throw error;
}

export async function assignTask(taskId: string, memberId: string | null): Promise<void> {
  const { error } = await (supabase as any)
    .from("trip_tasks")
    .update({ assigned_to: memberId })
    .eq("id", taskId);

  if (error) throw error;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await (supabase as any).from("trip_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

function mapTask(t: any): TripTask {
  return {
    id: t.id,
    trip_id: t.trip_id,
    title: t.title,
    is_completed: t.is_completed,
    assigned_to: t.assigned_to,
    created_by: t.created_by,
    created_at: t.created_at,
    completed_at: t.completed_at,
    assigned_to_name: t.trip_members?.display_name ?? null,
  };
}

// ----------------------------------------------------------------
// Realtime: keep the checklist in sync across everyone's devices.
// ----------------------------------------------------------------
export function subscribeToTasks(tripId: string, onChange: () => void): () => void {
  const channel = (supabase as any)
    .channel(`trip_tasks:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_tasks", filter: `trip_id=eq.${tripId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    (supabase as any).removeChannel(channel);
  };
}

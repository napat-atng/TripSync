import { supabase } from "./supabase";
import type { Availability, AvailabilityWithMember, DayAvailability } from "../types/availability";

export async function upsertAvailability(
  tripId: string,
  memberId: string,
  date: string,
  available: boolean,
): Promise<Availability> {
  const { data, error } = await (supabase as any)
    .from("availability")
    .upsert(
      { trip_id: tripId, member_id: memberId, date, available },
      { onConflict: "trip_id,member_id,date" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Availability;
}

export async function getAvailabilityByTrip(tripId: string): Promise<AvailabilityWithMember[]> {
  const { data, error } = await (supabase as any)
    .from("availability")
    .select(
      `
      *,
      trip_members!inner(display_name)
    `,
    )
    .eq("trip_id", tripId)
    .eq("available", true);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    trip_id: row.trip_id,
    member_id: row.member_id,
    date: row.date,
    available: row.available,
    display_name: row.trip_members?.display_name ?? null,
  })) as AvailabilityWithMember[];
}

export async function getMyAvailability(tripId: string, memberId: string): Promise<Availability[]> {
  const { data, error } = await (supabase as any)
    .from("availability")
    .select("*")
    .eq("trip_id", tripId)
    .eq("member_id", memberId);

  if (error) throw error;
  return (data ?? []) as Availability[];
}

// Returns dates sorted by number of available members (descending)
export async function getBestDates(tripId: string, topN = 3): Promise<DayAvailability[]> {
  const rows = await getAvailabilityByTrip(tripId);

  // Count per date
  const dateMap = new Map<string, { count: number; members: { member_id: string; display_name: string | null }[] }>();
  for (const row of rows) {
    if (!dateMap.has(row.date)) {
      dateMap.set(row.date, { count: 0, members: [] });
    }
    const entry = dateMap.get(row.date)!;
    entry.count += 1;
    entry.members.push({ member_id: row.member_id, display_name: row.display_name });
  }

  // Total unique members who marked anything
  const allMemberIds = new Set(rows.map((r) => r.member_id));
  const total = allMemberIds.size;

  const sorted = Array.from(dateMap.entries())
    .map(([date, { count, members }]) => ({ date, count, total, members }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));

  return sorted.slice(0, topN);
}

// Aggregate all rows into per-date summary (for heatmap)
export function aggregateByDate(
  rows: AvailabilityWithMember[],
  totalMembers: number,
): Map<string, DayAvailability> {
  const map = new Map<string, DayAvailability>();
  for (const row of rows) {
    if (!map.has(row.date)) {
      map.set(row.date, { date: row.date, count: 0, total: totalMembers, members: [] });
    }
    const entry = map.get(row.date)!;
    entry.count += 1;
    entry.members.push({ member_id: row.member_id, display_name: row.display_name });
  }
  return map;
}

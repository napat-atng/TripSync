import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { getTrip, listTrips } from "./service";
import { useRealtime } from "../../shared/useRealtime";

export function useTrips() {
  const { session } = useAuth();
  const userId = session?.user.id;
  useRealtime("trips", ["trips", userId]);
  useRealtime("trip_members", ["trips", userId]);
  return useQuery({ queryKey: ["trips", userId], queryFn: listTrips, enabled: !!userId });
}
export function useTrip(id: string) {
  const { session } = useAuth();
  useRealtime("trips", ["trip", session?.user.id, id], `id=eq.${id}`);
  return useQuery({ queryKey: ["trip", session?.user.id, id], queryFn: () => getTrip(id), enabled: !!session && !!id });
}

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "./supabase";

export function useRealtime(table: string, queryKey: QueryKey, filter?: string) {
  const queryClient = useQueryClient();
  const serializedKey = JSON.stringify(queryKey);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`${table}:${serializedKey}:${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "tripsync", table, ...(filter ? { filter } : {}) }, () => {
        void queryClient.invalidateQueries({ queryKey: JSON.parse(serializedKey) });
      }).subscribe(status => {
        if (status === "SUBSCRIBED") void queryClient.invalidateQueries({ queryKey: JSON.parse(serializedKey) });
      });
    return () => { void supabase?.removeChannel(channel); };
  }, [table, serializedKey, filter, queryClient]);
}

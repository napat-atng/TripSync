import { supabase } from "./supabase";
import type { Vote, VoteResponse, VoteWithResults } from "../types/vote";

export async function createVote(
  tripId: string,
  createdByMemberId: string,
  title: string,
  description?: string,
): Promise<Vote> {
  const { data, error } = await (supabase as any)
    .from("votes")
    .insert([
      {
        trip_id: tripId,
        created_by: createdByMemberId,
        title,
        description: description ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Vote;
}

export async function getVotesByTrip(tripId: string, myMemberId: string | null): Promise<VoteWithResults[]> {
  const { data, error } = await (supabase as any)
    .from("votes")
    .select(
      `
      *,
      vote_responses(
        *,
        trip_members(display_name)
      )
    `,
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((v: any) => mapVote(v, myMemberId));
}

export async function getVoteById(voteId: string, myMemberId: string | null): Promise<VoteWithResults | null> {
  const { data, error } = await (supabase as any)
    .from("votes")
    .select(
      `
      *,
      vote_responses(
        *,
        trip_members(display_name)
      )
    `,
    )
    .eq("id", voteId)
    .single();

  if (error) throw error;
  if (!data) return null;
  return mapVote(data, myMemberId);
}

function mapVote(v: any, myMemberId: string | null): VoteWithResults {
  const responses = (v.vote_responses ?? []).map((r: any) => ({
    id: r.id,
    vote_id: r.vote_id,
    member_id: r.member_id,
    answer: r.answer,
    created_at: r.created_at,
    display_name: r.trip_members?.display_name ?? null,
  }));

  const yes_count = responses.filter((r: any) => r.answer === true).length;
  const no_count = responses.filter((r: any) => r.answer === false).length;
  const mine = myMemberId ? responses.find((r: any) => r.member_id === myMemberId) : undefined;

  return {
    id: v.id,
    trip_id: v.trip_id,
    created_by: v.created_by,
    title: v.title,
    description: v.description,
    status: v.status,
    created_at: v.created_at,
    yes_count,
    no_count,
    my_answer: mine ? mine.answer : null,
    responses,
  };
}

export async function updateVote(voteId: string, newTitle: string) {
  const { error } = await (supabase as any)
    .from("votes")
    .update({ title: newTitle })
    .eq("id", voteId);

  if (error) {
    throw error;
  }
}

export async function deleteVote(voteId: string) {
  const { error } = await (supabase as any)
    .from("votes")
    .delete()
    .eq("id", voteId);

  if (error) {
    throw error;
  }
}

export async function castVote(voteId: string, memberId: string, answer: boolean): Promise<VoteResponse> {
  const { data, error } = await (supabase as any)
    .from("vote_responses")
    .upsert({ vote_id: voteId, member_id: memberId, answer }, { onConflict: "vote_id,member_id" })
    .select()
    .single();

  if (error) throw error;
  return data as VoteResponse;
}

export async function closeVote(voteId: string): Promise<void> {
  const { error } = await (supabase as any).from("votes").update({ status: "closed" }).eq("id", voteId);
  if (error) throw error;
}

/**
 * Subscribe to realtime changes on vote_responses for a given trip's votes.
 * Calls `onChange` whenever a response is inserted/updated/deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToVoteResponses(tripId: string, onChange: () => void): () => void {
  const channel = (supabase as any)
    .channel(`vote_responses:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "vote_responses" },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes", filter: `trip_id=eq.${tripId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    (supabase as any).removeChannel(channel);
  };
}

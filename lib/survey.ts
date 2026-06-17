import { supabase } from "./supabase";
import type { SurveyQuestion, SurveyResponse } from "../types/survey";

export async function getQuestions(tripId: string) {
  const { data, error } = await (supabase as any)
    .from("survey_questions")
    .select("*")
    .eq("trip_id", tripId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data as SurveyQuestion[];
}

export async function saveQuestions(tripId: string, questions: Omit<SurveyQuestion, "created_at">[]) {
  // First, get all existing questions to know what to delete
  const { data: existing } = await (supabase as any)
    .from("survey_questions")
    .select("id")
    .eq("trip_id", tripId);

  const incomingIds = questions.map((q) => q.id).filter((id) => id);

  if (existing) {
    const toDelete = existing.map((e: any) => e.id).filter((id: string) => !incomingIds.includes(id));
    if (toDelete.length > 0) {
      await (supabase as any).from("survey_questions").delete().in("id", toDelete);
    }
  }

  // Insert or Update the current questions
  if (questions.length > 0) {
    const { error } = await (supabase as any).from("survey_questions").upsert(
      questions.map((q) => ({
        id: q.id,
        trip_id: tripId,
        type: q.type,
        question: q.question,
        options: q.options,
        order_index: q.order_index,
      })),
    );
    if (error) throw error;
  }
}

/**
 * Submit (or re-submit) a member's answers to the trip survey.
 *
 * survey_responses has a unique constraint on (question_id, member_id), so
 * this upserts on that key rather than inserting blindly — letting a member
 * change their answers and resubmit without hitting a duplicate-key error.
 * trip_id is included for convenience/denormalized queries, but the DB also
 * back-fills it via trigger if it's ever omitted.
 */
export async function submitResponses(
  memberId: string,
  tripId: string,
  responses: Omit<SurveyResponse, "id" | "submitted_at" | "trip_id" | "member_id">[],
) {
  if (responses.length === 0) return;

  const payload = responses.map((r) => ({
    trip_id: tripId,
    member_id: memberId,
    question_id: r.question_id,
    answer: r.answer,
  }));

  const { error } = await (supabase as any)
    .from("survey_responses")
    .upsert(payload, { onConflict: "question_id,member_id" });

  if (error) throw error;
}

export async function getMyResponses(memberId: string, tripId: string) {
  const { data, error } = await (supabase as any)
    .from("survey_responses")
    .select("*")
    .eq("trip_id", tripId)
    .eq("member_id", memberId);

  if (error) throw error;
  return data as SurveyResponse[];
}

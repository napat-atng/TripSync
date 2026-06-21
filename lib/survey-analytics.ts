import { supabase } from "./supabase";
import { getQuestions } from "./survey";
import { getMembersByTrip } from "./members";
import type { SurveyQuestion } from "../types/survey";
import type { TripMember } from "../types/trip";

export interface MemberResponseStatus {
  member_id: string;
  display_name: string | null;
  responded: boolean;
}

export interface MultipleChoiceResult {
  type: "multiple_choice";
  question: SurveyQuestion;
  counts: { option: string; count: number }[];
  totalVotes: number;
}

export interface BudgetRangeResult {
  type: "budget_range";
  question: SurveyQuestion;
  min: number | null;
  max: number | null;
  median: number | null;
  values: number[];
}

export interface TextResult {
  type: "text";
  question: SurveyQuestion;
  answers: { member_id: string; display_name: string | null; answer: string }[];
}

export type QuestionResult = MultipleChoiceResult | BudgetRangeResult | TextResult;

export interface SurveyAnalytics {
  members: MemberResponseStatus[];
  totalMembers: number;
  respondedCount: number;
  completionPct: number;
  results: QuestionResult[];
  budgetRange: { min: number | null; max: number | null };
}

// Fetch all raw survey_responses + member display_name for a trip, joined with question
async function getAllResponsesWithMembers(tripId: string) {
  const { data, error } = await (supabase as any)
    .from("survey_responses")
    .select(
      `
      *,
      survey_questions!inner(trip_id),
      trip_members(display_name)
    `,
    )
    .eq("survey_questions.trip_id", tripId);

  if (error) throw error;
  return (data ?? []) as any[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function getSurveyAnalytics(tripId: string): Promise<SurveyAnalytics> {
  const [questions, members, rawResponses] = await Promise.all([
    getQuestions(tripId),
    getMembersByTrip(tripId),
    getAllResponsesWithMembers(tripId),
  ]);

  // Determine which members have submitted at least one response
  const respondedMemberIds = new Set(rawResponses.map((r: any) => r.member_id));
  const memberStatus: MemberResponseStatus[] = members.map((m: TripMember) => ({
    member_id: m.id,
    display_name: m.display_name,
    responded: respondedMemberIds.has(m.id),
  }));

  const totalMembers = members.length;
  const respondedCount = memberStatus.filter((m) => m.responded).length;
  const completionPct = totalMembers > 0 ? Math.round((respondedCount / totalMembers) * 100) : 0;

  const results: QuestionResult[] = questions.map((q) => {
    const answersForQuestion = rawResponses.filter((r: any) => r.question_id === q.id);

    if (q.type === "multiple_choice") {
      const optionList: string[] = Array.isArray(q.options) ? q.options : [];
      const countMap = new Map<string, number>(optionList.map((o) => [o, 0]));
      let totalVotes = 0;
      for (const r of answersForQuestion) {
        const selected: string[] = Array.isArray(r.answer) ? r.answer : [];
        for (const opt of selected) {
          countMap.set(opt, (countMap.get(opt) ?? 0) + 1);
          totalVotes += 1;
        }
      }
      return {
        type: "multiple_choice",
        question: q,
        counts: optionList.map((option) => ({ option, count: countMap.get(option) ?? 0 })),
        totalVotes,
      };
    }

    if (q.type === "budget_range") {
      const values: number[] = answersForQuestion
        .map((r: any) => (typeof r.answer === "number" ? r.answer : parseFloat(r.answer)))
        .filter((n: number) => !Number.isNaN(n));
      return {
        type: "budget_range",
        question: q,
        min: values.length > 0 ? Math.min(...values) : null,
        max: values.length > 0 ? Math.max(...values) : null,
        median: median(values),
        values,
      };
    }

    // text (and fallback)
    return {
      type: "text",
      question: q,
      answers: answersForQuestion
        .filter((r: any) => typeof r.answer === "string" && r.answer.trim().length > 0)
        .map((r: any) => ({
          member_id: r.member_id,
          display_name: r.trip_members?.display_name ?? null,
          answer: r.answer,
        })),
    };
  });

  // Aggregate a single "overall" budget range across all budget_range questions, for quick stats
  const allBudgetValues = results
    .filter((r): r is BudgetRangeResult => r.type === "budget_range")
    .flatMap((r) => r.values);

  const budgetRange = {
    min: allBudgetValues.length > 0 ? Math.min(...allBudgetValues) : null,
    max: allBudgetValues.length > 0 ? Math.max(...allBudgetValues) : null,
  };

  return {
    members: memberStatus,
    totalMembers,
    respondedCount,
    completionPct,
    results,
    budgetRange,
  };
}

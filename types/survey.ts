export type SurveyQuestionType = "date_range" | "multiple_choice" | "budget_range" | "text";

export interface SurveyQuestion {
  id: string;
  trip_id: string;
  type: SurveyQuestionType;
  question: string;
  options: any | null;
  order_index: number;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  trip_id: string;
  question_id: string;
  member_id: string;
  answer: any;
  submitted_at: string;
}

export type MultipleChoiceOptions = string[];
export type BudgetRangeOptions = { min: number; max: number; step: number };

export type DateRangeAnswer = { start: string; end: string } | null;
export type MultipleChoiceAnswer = string[];
export type BudgetRangeAnswer = number | null;
export type TextAnswer = string;

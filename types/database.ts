export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          destination: string | null;
          startsAt: string | null;
          endsAt: string | null;
          invite_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          destination?: string | null;
          startsAt?: string | null;
          endsAt?: string | null;
          invite_token: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          destination?: string | null;
          startsAt?: string | null;
          endsAt?: string | null;
          invite_token?: string;
          created_at?: string;
        };
      };
      trip_members: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string | null;
          display_name: string | null;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          user_id?: string | null;
          display_name?: string | null;
          role: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          user_id?: string | null;
          display_name?: string | null;
          role?: string;
          joined_at?: string;
        };
      };
      survey_questions: {
        Row: {
          id: string;
          trip_id: string;
          type: "date_range" | "multiple_choice" | "budget_range" | "text";
          question: string;
          options: any | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          type: "date_range" | "multiple_choice" | "budget_range" | "text";
          question: string;
          options?: any | null;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          type?: "date_range" | "multiple_choice" | "budget_range" | "text";
          question?: string;
          options?: any | null;
          order_index?: number;
          created_at?: string;
        };
      };
      survey_responses: {
        Row: {
          id: string;
          trip_id: string;
          question_id: string;
          member_id: string;
          answer: any;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          question_id: string;
          member_id: string;
          answer: any;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          question_id?: string;
          member_id?: string;
          answer?: any;
          submitted_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

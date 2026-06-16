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
          confirmed_date: string | null;
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
          confirmed_date?: string | null;
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
          confirmed_date?: string | null;
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
      availability: {
        Row: {
          id: string;
          trip_id: string;
          member_id: string;
          date: string;
          available: boolean;
        };
        Insert: {
          id?: string;
          trip_id: string;
          member_id: string;
          date: string;
          available: boolean;
        };
        Update: {
          id?: string;
          trip_id?: string;
          member_id?: string;
          date?: string;
          available?: boolean;
        };
      };
      expenses: {
        Row: {
          id: string;
          trip_id: string;
          paid_by: string;
          title: string;
          amount: number;
          currency: string;
          expense_date: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          paid_by: string;
          title: string;
          amount: number;
          currency?: string;
          expense_date?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          paid_by?: string;
          title?: string;
          amount?: number;
          currency?: string;
          expense_date?: string;
        };
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          member_id: string;
          share_amount: number;
          settled: boolean;
        };
        Insert: {
          id?: string;
          expense_id: string;
          member_id: string;
          share_amount: number;
          settled?: boolean;
        };
        Update: {
          id?: string;
          expense_id?: string;
          member_id?: string;
          share_amount?: number;
          settled?: boolean;
        };
      };
      votes: {
        Row: {
          id: string;
          trip_id: string;
          created_by: string;
          title: string;
          description: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      vote_responses: {
        Row: {
          id: string;
          vote_id: string;
          member_id: string;
          answer: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          member_id: string;
          answer: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          member_id?: string;
          answer?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

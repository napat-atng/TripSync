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
          trip_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          trip_id: string;
          user_id: string;
          role: string;
          joined_at?: string;
        };
        Update: {
          trip_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

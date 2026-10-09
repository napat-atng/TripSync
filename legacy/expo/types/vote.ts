export interface Vote {
  id: string;
  trip_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: "open" | "closed";
  created_at: string;
}

export interface VoteResponse {
  id: string;
  vote_id: string;
  member_id: string;
  answer: boolean;
  created_at: string;
}

export interface VoteWithResults extends Vote {
  yes_count: number;
  no_count: number;
  my_answer: boolean | null; // null = current member hasn't voted yet
  responses: (VoteResponse & { display_name: string | null })[];
}

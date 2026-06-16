export type Trip = {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startsAt: string | null;
  endsAt: string | null;
  invite_token: string;
  confirmed_date: string | null;
  created_at: string;
  trip_members?: { id: string; user_id: string; role: "leader" | "member" }[];
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string | null;
  display_name: string | null;
  role: "leader" | "member";
  joined_at: string;
};

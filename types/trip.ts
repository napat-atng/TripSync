export type Trip = {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startsAt: string | null;
  endsAt: string | null;
  invite_token: string;
  created_at: string;
};

export type TripMember = {
  trip_id: string;
  user_id: string;
  role: "leader" | "member";
  joined_at: string;
};

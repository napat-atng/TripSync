export type Participant = { user_id: string; invitation_status: string };
export type DateVote = { option_id: string; user_id: string; response: string };
export type PlaceVote = { option_id: string; user_id: string };
export type VoteSubmission = {
  user_id: string;
  date_submitted_at: string | null;
  place_submitted_at: string | null;
};

export function tallyVotes(input: {
  participants: Participant[];
  groupUserIds: string[];
  dateOptionIds: string[];
  placeOptionIds: string[];
  dateVotes: DateVote[];
  placeVotes: PlaceVote[];
  submissions: VoteSubmission[];
}) {
  const groupIds = new Set(input.groupUserIds);
  const eligible = new Set(input.participants
    .filter((person) => groupIds.has(person.user_id) && person.invitation_status !== "declined")
    .map((person) => person.user_id));
  const submittedDates = new Set(input.submissions
    .filter((item) => eligible.has(item.user_id) && item.date_submitted_at)
    .map((item) => item.user_id));
  const submittedPlaces = new Set(input.submissions
    .filter((item) => eligible.has(item.user_id) && item.place_submitted_at)
    .map((item) => item.user_id));

  return {
    eligibleCount: eligible.size,
    dateSubmittedCount: submittedDates.size,
    placeSubmittedCount: submittedPlaces.size,
    datePendingUserIds: [...eligible].filter((id) => !submittedDates.has(id)),
    placePendingUserIds: [...eligible].filter((id) => !submittedPlaces.has(id)),
    dates: input.dateOptionIds.map((id) => ({
      id,
      available: input.dateVotes.filter((vote) => vote.option_id === id && eligible.has(vote.user_id) && vote.response === "available").length,
      maybe: input.dateVotes.filter((vote) => vote.option_id === id && eligible.has(vote.user_id) && vote.response === "maybe").length,
      unavailable: input.dateVotes.filter((vote) => vote.option_id === id && eligible.has(vote.user_id) && vote.response === "unavailable").length,
    })),
    places: input.placeOptionIds.map((id) => ({
      id,
      selected: input.placeVotes.filter((vote) => vote.option_id === id && eligible.has(vote.user_id)).length,
    })),
  };
}

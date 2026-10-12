import assert from "node:assert/strict";
import test from "node:test";
import { tallyVotes } from "./tally.ts";

test("counts only current invited group members and separates answers from missing submissions", () => {
  const summary = tallyVotes({
    participants: [
      { user_id: "A", invitation_status: "interested" },
      { user_id: "B", invitation_status: "pending" },
      { user_id: "C", invitation_status: "declined" },
      { user_id: "D", invitation_status: "interested" },
    ],
    groupUserIds: ["A", "B", "C", "E"],
    dateOptionIds: ["date-1"],
    placeOptionIds: ["place-1"],
    dateVotes: [
      { option_id: "date-1", user_id: "A", response: "unavailable" },
      { option_id: "date-1", user_id: "C", response: "available" },
      { option_id: "date-1", user_id: "D", response: "available" },
    ],
    placeVotes: [{ option_id: "place-1", user_id: "C" }],
    submissions: [
      { user_id: "A", date_submitted_at: "today", place_submitted_at: "today" },
      { user_id: "C", date_submitted_at: "today", place_submitted_at: "today" },
    ],
  });

  assert.equal(summary.eligibleCount, 2);
  assert.equal(summary.dateSubmittedCount, 1);
  assert.equal(summary.placeSubmittedCount, 1);
  assert.deepEqual(summary.datePendingUserIds, ["B"]);
  assert.deepEqual(summary.placePendingUserIds, ["B"]);
  assert.deepEqual(summary.dates[0], { id: "date-1", available: 0, maybe: 0, unavailable: 1 });
  assert.deepEqual(summary.places[0], { id: "place-1", selected: 0 });
});

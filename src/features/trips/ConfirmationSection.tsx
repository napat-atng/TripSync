import { PlanForm } from "@/components/PlanForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { tallyVotes, type Participant } from "@/features/voting/tally";
import { isBeforeDeadline } from "@/features/voting/time";
import { submitRsvp } from "./plan-actions";
import { zonedInputValue } from "./time";

type Trip = {
  id: string;
  status: string;
  organizer_id: string;
  vote_deadline: string;
  selected_date_option_id: string | null;
  selected_place_option_id: string | null;
  meeting_at: string | null;
  meeting_point: string | null;
  plan_version: number;
  timezone: string;
};

export async function ConfirmationSection({
  trip, userId, participants, groupUserIds, names,
}: {
  trip: Trip;
  userId: string;
  participants: Participant[];
  groupUserIds: string[];
  names: Map<string, string>;
}) {
  if (trip.status === "draft" || (trip.status === "voting" && isBeforeDeadline(trip.vote_deadline))) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const [datesResult, placesResult, dateVotesResult, placeVotesResult, rsvpsResult] = await Promise.all([
    supabase.from("date_options").select("id, starts_on, ends_on").eq("trip_id", trip.id).order("starts_on"),
    supabase.from("place_options").select("id, name").eq("trip_id", trip.id).order("created_at"),
    supabase.from("date_votes").select("option_id, user_id, response").eq("trip_id", trip.id),
    supabase.from("place_votes").select("option_id, user_id").eq("trip_id", trip.id),
    supabase.from("trip_rsvps").select("user_id, plan_version, response").eq("trip_id", trip.id),
  ]);
  const dates = datesResult.data ?? [];
  const places = placesResult.data ?? [];
  const dateVotes = dateVotesResult.data ?? [];
  const placeVotes = placeVotesResult.data ?? [];
  const rsvps = rsvpsResult.data ?? [];
  const summary = tallyVotes({
    participants, groupUserIds,
    dateOptionIds: dates.map((option) => option.id),
    placeOptionIds: places.map((option) => option.id),
    dateVotes, placeVotes, submissions: [],
  });
  const eligible = new Set(participants
    .filter((person) => person.invitation_status !== "declined" && groupUserIds.includes(person.user_id))
    .map((person) => person.user_id));
  const dateChoices = dates.map((option) => {
    const counts = summary.dates.find((item) => item.id === option.id);
    return {
      id: option.id,
      label: option.starts_on === option.ends_on ? option.starts_on : `${option.starts_on} – ${option.ends_on}`,
      available: counts?.available ?? 0,
      maybe: counts?.maybe ?? 0,
    };
  });
  const placeChoices = places.map((option) => {
    const counts = summary.places.find((item) => item.id === option.id);
    const byDate: Record<string, number> = {};
    for (const date of dates) {
      const available = new Set(dateVotes.filter((vote) => vote.option_id === date.id
        && vote.response === "available" && eligible.has(vote.user_id)).map((vote) => vote.user_id));
      byDate[date.id] = placeVotes.filter((vote) => vote.option_id === option.id
        && available.has(vote.user_id)).length;
    }
    return { id: option.id, name: option.name, total: counts?.selected ?? 0, byDate };
  });
  const isOrganizer = trip.organizer_id === userId;
  const chosenDate = dates.find((option) => option.id === trip.selected_date_option_id);
  const chosenPlace = places.find((option) => option.id === trip.selected_place_option_id);
  const currentRsvps = rsvps.filter((item) => item.plan_version === trip.plan_version
    && eligible.has(item.user_id));
  const myRsvp = currentRsvps.find((item) => item.user_id === userId);
  const hadPastRsvp = rsvps.some((item) => item.user_id === userId && item.plan_version < trip.plan_version);
  const canRsvp = trip.status === "confirmed" && eligible.has(userId);

  return (
    <section id="confirmation-section" className="group-list">
      <h2>{trip.status === "voting" ? "สรุปผลและยืนยันแผน" : "แผนที่ยืนยัน"}</h2>
      {chosenDate && chosenPlace && <div className="confirmed-plan">
        <p><strong>วัน:</strong> {chosenDate.starts_on}{chosenDate.ends_on !== chosenDate.starts_on && ` – ${chosenDate.ends_on}`}</p>
        <p><strong>สถานที่:</strong> {chosenPlace.name}</p>
        {trip.meeting_at && <p><strong>เวลานัดพบ:</strong> {new Date(trip.meeting_at).toLocaleString("th-TH", { timeZone: trip.timezone })}</p>}
        <p><strong>จุดนัดพบ:</strong> {trip.meeting_point}</p>
        <p>แผนรุ่นที่ {trip.plan_version}</p>
      </div>}
      {isOrganizer && (trip.status === "voting" || trip.status === "confirmed") && (
        <PlanForm
          tripId={trip.id}
          mode={trip.status === "voting" ? "confirm" : "change"}
          dates={dateChoices}
          places={placeChoices}
          selectedDateId={trip.selected_date_option_id}
          selectedPlaceId={trip.selected_place_option_id}
          meetingLocal={zonedInputValue(trip.meeting_at, trip.timezone)}
          meetingPoint={trip.meeting_point}
          timezone={trip.timezone}
        />
      )}
      {trip.status === "voting" && !isOrganizer && <p>รอผู้จัดเลือกวันและสถานที่จากผลโหวต</p>}
      {trip.plan_version > 0 && <div className="rsvp-summary">
        <h3>ตอบรับแผนปัจจุบัน</h3>
        <p>ไป {currentRsvps.filter((item) => item.response === "going").length} · อาจไป {currentRsvps.filter((item) => item.response === "maybe").length} · ไม่ไป {currentRsvps.filter((item) => item.response === "not_going").length}</p>
        <p>ผู้ที่ไป: {currentRsvps.filter((item) => item.response === "going")
          .map((item) => names.get(item.user_id) ?? item.user_id.slice(0, 8)).join(", ") || "ยังไม่มี"}</p>
        {canRsvp && <>
          <p>{myRsvp ? `คำตอบของคุณ: ${myRsvp.response}` : hadPastRsvp ? "แผนเปลี่ยนแล้ว ต้องตอบรับใหม่" : "ยังไม่ตอบรับแผนนี้"}</p>
          <form action={submitRsvp} className="inline-actions">
            <input type="hidden" name="tripId" value={trip.id} />
            <button className="primary-button" type="submit" name="response" value="going">ไป</button>
            <button className="text-button" type="submit" name="response" value="maybe">อาจไป</button>
            <button className="text-button" type="submit" name="response" value="not_going">ไม่ไป</button>
          </form>
        </>}
      </div>}
    </section>
  );
}

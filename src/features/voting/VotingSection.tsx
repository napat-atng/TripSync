import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  addDateOption, addPlaceOption, editDateOption, editPlaceOption, openVoting, removeOption,
  submitDateVotes, submitPlaceVotes,
} from "./actions";
import { tallyVotes, type Participant } from "./tally";
import { isBeforeDeadline, isDeadlineNear } from "./time";

type Trip = {
  id: string;
  status: string;
  organizer_id: string;
  vote_deadline: string;
};

export async function VotingSection({
  trip,
  userId,
  participants,
  groupUserIds,
  names,
}: {
  trip: Trip;
  userId: string;
  participants: Participant[];
  groupUserIds: string[];
  names: Map<string, string>;
}) {
  const supabase = await createServerSupabaseClient();
  const [datesResult, placesResult, dateVotesResult, placeVotesResult, submissionsResult] = await Promise.all([
    supabase.from("date_options").select("id, starts_on, ends_on").eq("trip_id", trip.id).order("starts_on"),
    supabase.from("place_options").select("id, name, address, map_url").eq("trip_id", trip.id).order("created_at"),
    supabase.from("date_votes").select("option_id, user_id, response").eq("trip_id", trip.id),
    supabase.from("place_votes").select("option_id, user_id").eq("trip_id", trip.id),
    supabase.from("vote_submissions").select("user_id, date_submitted_at, place_submitted_at").eq("trip_id", trip.id),
  ]);
  const dates = datesResult.data ?? [];
  const places = placesResult.data ?? [];
  const dateVotes = dateVotesResult.data ?? [];
  const placeVotes = placeVotesResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const summary = tallyVotes({
    participants,
    groupUserIds,
    dateOptionIds: dates.map((option) => option.id),
    placeOptionIds: places.map((option) => option.id),
    dateVotes,
    placeVotes,
    submissions,
  });
  const myParticipation = participants.find((person) => person.user_id === userId);
  const canPropose = trip.status === "draft" && myParticipation?.invitation_status !== "declined" && !!myParticipation;
  const canSubmit = trip.status === "voting" && isBeforeDeadline(trip.vote_deadline)
    && myParticipation?.invitation_status !== "declined" && !!myParticipation;
  const isOrganizer = trip.organizer_id === userId;
  const myDateVotes = new Map(dateVotes.filter((vote) => vote.user_id === userId)
    .map((vote) => [vote.option_id, vote.response]));
  const myPlaceVotes = new Set(placeVotes.filter((vote) => vote.user_id === userId)
    .map((vote) => vote.option_id));
  const mySubmission = submissions.find((item) => item.user_id === userId);
  const deadlineSoon = canSubmit && isDeadlineNear(trip.vote_deadline);
  const needsAnswer = !mySubmission?.date_submitted_at || !mySubmission?.place_submitted_at;

  return (
    <section id="vote-section" className="group-list">
      <h2>ตัวเลือกและโหวต</h2>
      {deadlineSoon && needsAnswer && <p className="form-note" role="status">
        ใกล้ปิดโหวตแล้ว: {`${!mySubmission?.date_submitted_at ? "ตอบวัน" : ""}${!mySubmission?.date_submitted_at && !mySubmission?.place_submitted_at ? "และ" : ""}${!mySubmission?.place_submitted_at ? "ตอบสถานที่" : ""}`}ก่อนกำหนด
      </p>}
      {trip.status === "voting" && !canSubmit && !isBeforeDeadline(trip.vote_deadline)
        && <p>หมดเวลาโหวตแล้ว รอผู้จัดสรุปแผน</p>}
      <h3>วันเดินทาง</h3>
      {dates.length ? <ul>{dates.map((option) => {
        const counts = summary.dates.find((item) => item.id === option.id);
        return <li key={option.id}>
          <strong>{option.starts_on}{option.ends_on !== option.starts_on && ` – ${option.ends_on}`}</strong>
          {trip.status !== "draft" && <span>ว่าง {counts?.available ?? 0} · อาจว่าง {counts?.maybe ?? 0} · ไม่ว่าง {counts?.unavailable ?? 0}</span>}
          {isOrganizer && trip.status === "draft" && <form action={removeOption}>
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="optionId" value={option.id} />
            <input type="hidden" name="kind" value="date" />
            <button type="submit" className="text-button">ลบตัวเลือก</button>
          </form>}
          {isOrganizer && trip.status === "draft" && <details>
            <summary>แก้ตัวเลือก</summary>
            <form action={editDateOption} className="group-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="optionId" value={option.id} />
              <label>วันเริ่ม<input name="startsOn" type="date" required defaultValue={option.starts_on} /></label>
              <label>วันสิ้นสุด<input name="endsOn" type="date" required defaultValue={option.ends_on} /></label>
              <button type="submit" className="primary-button">บันทึก</button>
            </form>
          </details>}
        </li>;
      })}</ul> : <p>ยังไม่มีตัวเลือกวัน</p>}
      {canPropose && <form action={addDateOption} className="group-form">
        <input type="hidden" name="tripId" value={trip.id} />
        <label htmlFor="date-start">วันเริ่ม</label>
        <input id="date-start" name="startsOn" type="date" required />
        <label htmlFor="date-end">วันสิ้นสุด</label>
        <input id="date-end" name="endsOn" type="date" required />
        <button type="submit" className="primary-button">เสนอวัน</button>
      </form>}

      <h3>สถานที่</h3>
      {places.length ? <ul>{places.map((option) => {
        const counts = summary.places.find((item) => item.id === option.id);
        return <li key={option.id}>
          <strong>{option.name}</strong>
          {option.address && <span>{option.address}</span>}
          {option.map_url && <a href={option.map_url} target="_blank" rel="noopener noreferrer">เปิดแผนที่</a>}
          {trip.status !== "draft" && <span>เลือก {counts?.selected ?? 0} คน</span>}
          {isOrganizer && trip.status === "draft" && <form action={removeOption}>
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="optionId" value={option.id} />
            <input type="hidden" name="kind" value="place" />
            <button type="submit" className="text-button">ลบตัวเลือก</button>
          </form>}
          {isOrganizer && trip.status === "draft" && <details>
            <summary>แก้ตัวเลือก</summary>
            <form action={editPlaceOption} className="group-form">
              <input type="hidden" name="tripId" value={trip.id} />
              <input type="hidden" name="optionId" value={option.id} />
              <label>ชื่อสถานที่<input name="name" required maxLength={160} defaultValue={option.name} /></label>
              <label>ที่อยู่<input name="address" maxLength={500} defaultValue={option.address ?? ""} /></label>
              <label>ลิงก์แผนที่<input name="mapUrl" type="url" maxLength={1000} defaultValue={option.map_url ?? ""} /></label>
              <button type="submit" className="primary-button">บันทึก</button>
            </form>
          </details>}
        </li>;
      })}</ul> : <p>ยังไม่มีตัวเลือกสถานที่</p>}
      {canPropose && <form action={addPlaceOption} className="group-form">
        <input type="hidden" name="tripId" value={trip.id} />
        <label htmlFor="place-name">ชื่อสถานที่</label>
        <input id="place-name" name="name" required maxLength={160} />
        <label htmlFor="place-address">ที่อยู่ (ไม่บังคับ)</label>
        <input id="place-address" name="address" maxLength={500} />
        <label htmlFor="place-map">ลิงก์แผนที่ (ไม่บังคับ)</label>
        <input id="place-map" name="mapUrl" type="url" maxLength={1000} />
        <button type="submit" className="primary-button">เสนอสถานที่</button>
      </form>}

      {isOrganizer && trip.status === "draft" && <form action={openVoting}>
        <input type="hidden" name="tripId" value={trip.id} />
        <button className="primary-button" type="submit" disabled={!dates.length || !places.length || !isBeforeDeadline(trip.vote_deadline)}>
          เปิดโหวตและล็อกตัวเลือก
        </button>
      </form>}

      {trip.status === "voting" && <div className="vote-summary">
        <p>ตอบวันแล้ว {summary.dateSubmittedCount}/{summary.eligibleCount} · ตอบสถานที่แล้ว {summary.placeSubmittedCount}/{summary.eligibleCount}</p>
        {!!summary.datePendingUserIds.length && <p>ยังไม่ตอบวัน: {summary.datePendingUserIds.map((id) => names.get(id) ?? id.slice(0, 8)).join(", ")}</p>}
        {!!summary.placePendingUserIds.length && <p>ยังไม่ตอบสถานที่: {summary.placePendingUserIds.map((id) => names.get(id) ?? id.slice(0, 8)).join(", ")}</p>}
      </div>}

      {canSubmit && <>
        <form action={submitDateVotes} className="vote-form">
          <h3>วันไหนสะดวกบ้าง</h3>
          <input type="hidden" name="tripId" value={trip.id} />
          {dates.map((option) => <fieldset key={option.id}>
            <legend>{option.starts_on}{option.ends_on !== option.starts_on && ` – ${option.ends_on}`}</legend>
            {(["available", "maybe", "unavailable"] as const).map((answer) => <label key={answer}>
              <input type="radio" name={`date-${option.id}`} value={answer} required defaultChecked={myDateVotes.get(option.id) === answer} />
              {answer === "available" ? "ว่าง" : answer === "maybe" ? "อาจว่าง" : "ไม่ว่าง"}
            </label>)}
          </fieldset>)}
          <button className="primary-button" type="submit">{mySubmission?.date_submitted_at ? "แก้คำตอบวัน" : "ส่งคำตอบวัน"}</button>
        </form>
        <form action={submitPlaceVotes} className="vote-form">
          <h3>สถานที่ที่สนใจ</h3>
          <p>เลือกได้หลายแห่ง หรือไม่เลือกเลยหากไม่มีที่ที่ต้องการ</p>
          <input type="hidden" name="tripId" value={trip.id} />
          {places.map((option) => <label key={option.id}>
            <input type="checkbox" name="placeId" value={option.id} defaultChecked={myPlaceVotes.has(option.id)} />
            {option.name}
          </label>)}
          <button className="primary-button" type="submit">{mySubmission?.place_submitted_at ? "แก้คำตอบสถานที่" : "ส่งคำตอบสถานที่"}</button>
        </form>
      </>}
    </section>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateInvite } from "@/components/CreateInvite";
import { revokeInvite } from "@/features/access/invite-actions";
import { addTripParticipant, removeTripParticipant, respondToTripInvitation } from "@/features/trips/participant-actions";
import { VotingSection } from "@/features/voting/VotingSection";
import { ConfirmationSection } from "@/features/trips/ConfirmationSection";
import { cancelTrip, completeTrip } from "@/features/trips/plan-actions";
import { editDraftTrip } from "@/features/trips/actions";
import { bangkokInputValue } from "@/features/trips/time";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  revoke: "ยกเลิกลิงก์ไม่สำเร็จ",
  participant: "แก้ผู้ร่วมทริปไม่สำเร็จ",
  response: "ตอบคำเชิญไม่สำเร็จ",
  "date-option": "เพิ่มตัวเลือกวันไม่สำเร็จ",
  "place-option": "เพิ่มตัวเลือกสถานที่ไม่สำเร็จ",
  option: "ลบตัวเลือกไม่สำเร็จ",
  open: "เปิดโหวตไม่สำเร็จ ตรวจว่ามีวันและสถานที่อย่างน้อยอย่างละหนึ่งตัวเลือก",
  "voting-closed": "หมดเวลาโหวตแล้ว",
  "date-vote": "บันทึกคำตอบวันไม่สำเร็จ",
  "place-vote": "บันทึกคำตอบสถานที่ไม่สำเร็จ",
  plan: "ยืนยันหรือเปลี่ยนแผนไม่สำเร็จ กรุณาตรวจวัน สถานที่ และเวลานัดพบ",
  rsvp: "บันทึกการตอบรับไม่สำเร็จ",
  cancel: "ยกเลิกทริปไม่สำเร็จ",
  complete: "จบทริปไม่สำเร็จ ต้องรอให้วันเดินทางสิ้นสุดก่อน",
  edit: "แก้รายละเอียดทริปไม่สำเร็จ ตรวจข้อมูลและเวลาปิดโหวต",
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tripId } = await params;
  const { error: pageError } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/trips/${tripId}`)}`);
  }

  const { data: trip, error } = await supabase.from("trips")
    .select("id, group_id, title, description, status, vote_deadline, timezone, organizer_id, selected_date_option_id, selected_place_option_id, meeting_at, meeting_point, plan_version, cancelled_reason")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) notFound();
  const [{ data: participants }, { data: groupMembers }] = await Promise.all([
    supabase.from("trip_participants").select("user_id, invitation_status").eq("trip_id", tripId),
    supabase.from("group_members").select("user_id").eq("group_id", trip.group_id),
  ]);
  const userIds = groupMembers?.map((member) => member.user_id) ?? [];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [] };
  const names = new Map(profiles?.map((profile) => [profile.user_id, profile.display_name]));
  const participantIds = new Set(participants?.map((person) => person.user_id));
  const availableMembers = groupMembers?.filter((member) => !participantIds.has(member.user_id)) ?? [];
  const myParticipation = participants?.find((person) => person.user_id === auth.claims.sub);
  const isOrganizer = trip.organizer_id === auth.claims.sub;
  const { data: inviteLinks } = isOrganizer
    ? await supabase.from("invite_links")
        .select("id, expires_at, revoked_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <main className="page">
      <div className="card dashboard-card">
        <Link href={`/groups/${trip.group_id}`} className="text-link">← กลับกลุ่ม</Link>
        <h1>{trip.title}</h1>
        {trip.description && <p>{trip.description}</p>}
        <p>สถานะ: {trip.status === "draft" ? "กำลังเตรียมตัวเลือก" : trip.status}</p>
        <p>ปิดโหวต: {new Date(trip.vote_deadline).toLocaleString("th-TH", { timeZone: trip.timezone })}</p>
        {trip.status === "cancelled" && <p>เหตุผลที่ยกเลิก: {trip.cancelled_reason || "ไม่ได้ระบุ"}</p>}
        {pageError && <p className="form-note" role="alert">{errorMessages[pageError] ?? "เกิดข้อผิดพลาด"} กรุณาลองอีกครั้ง</p>}
        {isOrganizer && trip.status === "draft" && <section className="group-list">
          <h2>แก้รายละเอียดทริป</h2>
          <form action={editDraftTrip} className="group-form">
            <input type="hidden" name="tripId" value={tripId} />
            <label htmlFor="edit-trip-title">ชื่อทริป</label>
            <input id="edit-trip-title" name="title" required maxLength={160} defaultValue={trip.title} />
            <label htmlFor="edit-trip-description">รายละเอียด</label>
            <textarea id="edit-trip-description" name="description" maxLength={1000} rows={3} defaultValue={trip.description} />
            <label htmlFor="edit-trip-deadline">เวลาปิดโหวต (เวลาไทย)</label>
            <input id="edit-trip-deadline" name="deadlineLocal" type="datetime-local" required defaultValue={bangkokInputValue(trip.vote_deadline)} />
            <button className="primary-button" type="submit">บันทึกการแก้ไข</button>
          </form>
        </section>}
        {!isOrganizer && myParticipation && trip.status !== "cancelled" && trip.status !== "completed" && (
          <section className="group-list">
            <h2>คำเชิญของคุณ</h2>
            <p>สถานะ: {myParticipation.invitation_status}</p>
            <form action={respondToTripInvitation} className="inline-actions">
              <input type="hidden" name="tripId" value={tripId} />
              <button className="primary-button" type="submit" name="status" value="interested">สนใจไป</button>
              <button className="text-button" type="submit" name="status" value="declined">ไม่ร่วมทริป</button>
            </form>
          </section>
        )}
        {isOrganizer && trip.status !== "cancelled" && trip.status !== "completed" && (
          <CreateInvite groupId={trip.group_id} tripId={trip.id} />
        )}
        {isOrganizer && !!inviteLinks?.length && <section className="group-list">
          <h2>ลิงก์เชิญทริป</h2>
          <ul>{inviteLinks.map((link) => <li key={link.id}>
            <strong>{link.revoked_at ? "ยกเลิกแล้ว" : "ยังไม่เพิกถอน"}</strong>
            <span>หมดอายุ {new Date(link.expires_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
            {!link.revoked_at && <form action={revokeInvite}>
              <input type="hidden" name="groupId" value={trip.group_id} />
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="inviteId" value={link.id} />
              <button className="text-button" type="submit">ยกเลิกลิงก์นี้</button>
            </form>}
          </li>)}</ul>
        </section>}
        <section className="group-list">
          <h2>ผู้ร่วมทริป</h2>
          {participants?.length ? <ul>{participants.map((person) => <li key={person.user_id}>
            <strong>{names.get(person.user_id) ?? person.user_id.slice(0, 8)}</strong>
            <span>{person.invitation_status}</span>
            {isOrganizer && trip.status === "draft" && person.user_id !== auth.claims.sub && (
              <form action={removeTripParticipant}>
                <input type="hidden" name="tripId" value={tripId} />
                <input type="hidden" name="userId" value={person.user_id} />
                <button className="text-button" type="submit">นำออก</button>
              </form>
            )}
          </li>)}</ul> : <p>ยังไม่มีผู้ร่วมทริป</p>}
        </section>
        {isOrganizer && trip.status === "draft" && !!availableMembers.length && (
          <section className="group-list">
            <h2>ชวนสมาชิกกลุ่มเข้าทริป</h2>
            <form action={addTripParticipant} className="group-form">
              <input type="hidden" name="tripId" value={tripId} />
              <label htmlFor="participant-user">เลือกสมาชิก</label>
              <select id="participant-user" name="userId" required>
                {availableMembers.map((member) => <option key={member.user_id} value={member.user_id}>
                  {names.get(member.user_id) ?? member.user_id.slice(0, 8)}
                </option>)}
              </select>
              <button className="primary-button" type="submit">ส่งคำเชิญในทริป</button>
            </form>
          </section>
        )}
        <VotingSection
          trip={trip}
          userId={auth.claims.sub}
          participants={participants ?? []}
          groupUserIds={userIds}
          names={names}
        />
        <ConfirmationSection
          trip={trip}
          userId={auth.claims.sub}
          participants={participants ?? []}
          groupUserIds={userIds}
          names={names}
        />
        {isOrganizer && ["draft", "voting", "confirmed"].includes(trip.status) && (
          <section className="group-list">
            <h2>จัดการทริป</h2>
            {trip.status === "confirmed" && <form action={completeTrip}>
              <input type="hidden" name="tripId" value={tripId} />
              <button className="text-button" type="submit">ทำเครื่องหมายว่าจบทริปแล้ว</button>
            </form>}
            <form action={cancelTrip} className="group-form">
              <input type="hidden" name="tripId" value={tripId} />
              <label htmlFor="cancel-reason">เหตุผลที่ยกเลิก (ไม่บังคับ)</label>
              <input id="cancel-reason" name="reason" maxLength={500} />
              <button className="text-button" type="submit">ยกเลิกทริป</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

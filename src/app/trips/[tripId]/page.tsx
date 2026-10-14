import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateInvite } from "@/components/CreateInvite";
import { revokeInvite } from "@/features/access/invite-actions";
import { addTripParticipant, removeTripParticipant, respondToTripInvitation } from "@/features/trips/participant-actions";
import { VotingSection } from "@/features/voting/VotingSection";
import { ConfirmationSection } from "@/features/trips/ConfirmationSection";
import { ShareTrip } from "@/components/ShareTrip";
import { cancelTrip, completeTrip, deleteTrip } from "@/features/trips/plan-actions";
import { editDraftTrip } from "@/features/trips/actions";
import { zonedInputValue } from "@/features/trips/time";
import { isBeforeDeadline } from "@/features/voting/time";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

const errorMessages: Record<string, string> = {
  revoke: "ยกเลิกลิงก์ไม่สำเร็จ",
  participant: "แก้ผู้ร่วมทริปไม่สำเร็จ",
  response: "ตอบคำเชิญไม่สำเร็จ",
  "date-option": "บันทึกวันไม่สำเร็จ วันสิ้นสุดต้องไม่ก่อนวันปิดโหวตหรืออยู่ในอดีต",
  "place-option": "เพิ่มตัวเลือกสถานที่ไม่สำเร็จ",
  option: "ลบตัวเลือกไม่สำเร็จ",
  open: "เปิดโหวตไม่สำเร็จ ตรวจว่ามีวันและสถานที่อย่างน้อยอย่างละหนึ่งตัวเลือก และวันเดินทางยังไม่ผ่านไป",
  "voting-closed": "หมดเวลาโหวตแล้ว",
  "date-vote": "บันทึกคำตอบวันไม่สำเร็จ",
  "place-vote": "บันทึกคำตอบสถานที่ไม่สำเร็จ",
  plan: "ยืนยันหรือเปลี่ยนแผนไม่สำเร็จ กรุณาตรวจวัน สถานที่ และเวลานัดพบ",
  rsvp: "บันทึกการตอบรับไม่สำเร็จ",
  cancel: "ยกเลิกทริปไม่สำเร็จ",
  complete: "จบทริปไม่สำเร็จ ต้องรอให้วันเดินทางสิ้นสุดก่อน",
  delete: "ลบทริปไม่สำเร็จ ตรวจชื่อที่พิมพ์ หรือยกเลิกทริปที่กำลังดำเนินการก่อน",
  edit: "แก้รายละเอียดทริปไม่สำเร็จ ตรวจข้อมูลและเวลาปิดโหวต",
};
const statusLabels: Record<string, string> = {
  draft: "กำลังเตรียมตัวเลือก",
  voting: "กำลังโหวต",
  confirmed: "ยืนยันแผนแล้ว",
  completed: "จบทริปแล้ว",
  cancelled: "ยกเลิกแล้ว",
};
const invitationLabels: Record<string, string> = {
  pending: "รอตอบคำเชิญ",
  interested: "เข้าร่วมทริป",
  declined: "ไม่ร่วมทริป",
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
  const [{ data: participants }, { data: groupMembers }, { data: mySubmission }, { data: myRsvp }] = await Promise.all([
    supabase.from("trip_participants").select("user_id, invitation_status").eq("trip_id", tripId),
    supabase.from("group_members").select("user_id").eq("group_id", trip.group_id),
    supabase.from("vote_submissions").select("date_submitted_at, place_submitted_at")
      .eq("trip_id", tripId).eq("user_id", auth.claims.sub).maybeSingle(),
    trip.plan_version > 0
      ? supabase.from("trip_rsvps").select("response").eq("trip_id", tripId)
          .eq("user_id", auth.claims.sub).eq("plan_version", trip.plan_version).maybeSingle()
      : Promise.resolve({ data: null }),
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
  const isActiveParticipant = !!myParticipation && myParticipation.invitation_status !== "declined";
  let nextAction: { text: string; href?: string };
  if (trip.status === "draft") {
    nextAction = isOrganizer
      ? { text: "เพิ่มตัวเลือกวันและสถานที่ แล้วเปิดโหวต", href: "#vote-section" }
      : !myParticipation
        ? { text: "คุณยังไม่ได้รับคำเชิญเข้าร่วมทริปนี้" }
      : myParticipation?.invitation_status === "pending"
        ? { text: "ตอบคำเชิญเข้าร่วมทริป", href: "#invitation-section" }
        : myParticipation?.invitation_status === "declined"
          ? { text: "คุณปฏิเสธคำเชิญแล้ว หากเปลี่ยนใจสามารถตอบรับใหม่", href: "#invitation-section" }
        : { text: "ดูหรือเสนอตัวเลือกวันและสถานที่", href: "#vote-section" };
  } else if (trip.status === "voting" && isBeforeDeadline(trip.vote_deadline)) {
    nextAction = !isActiveParticipant
      ? { text: myParticipation ? "คุณปฏิเสธคำเชิญแล้ว หากเปลี่ยนใจสามารถตอบรับใหม่" : "คุณยังไม่ได้รับคำเชิญเข้าร่วมทริปนี้", href: myParticipation ? "#invitation-section" : undefined }
      : (!mySubmission?.date_submitted_at || !mySubmission?.place_submitted_at)
      ? { text: "โหวตวันและสถานที่ให้ครบก่อนกำหนด", href: "#vote-section" }
      : { text: "ส่งคำตอบครบแล้ว รอผลโหวต" };
  } else if (trip.status === "voting") {
    nextAction = isOrganizer
      ? { text: "ตรวจผลโหวตและยืนยันแผน", href: "#confirmation-section" }
      : { text: "หมดเวลาโหวตแล้ว รอผู้จัดสรุปแผน" };
  } else if (trip.status === "confirmed") {
    nextAction = isActiveParticipant && !myRsvp
      ? { text: "ตอบรับแผนล่าสุด", href: "#confirmation-section" }
      : { text: "ดูแผนที่ยืนยันและรายชื่อผู้ไป", href: "#confirmation-section" };
  } else {
    nextAction = { text: trip.status === "cancelled" ? "ทริปนี้ถูกยกเลิกแล้ว" : "ทริปนี้จบแล้ว" };
  }
  const { data: inviteLinks } = isOrganizer
    ? await supabase.from("invite_links")
        .select("id, expires_at, revoked_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
    : { data: null };
  const [{ data: shareDate }, { data: sharePlace }] = await Promise.all([
    trip.selected_date_option_id
      ? supabase.from("date_options").select("starts_on, ends_on").eq("id", trip.selected_date_option_id).maybeSingle()
      : Promise.resolve({ data: null }),
    trip.selected_place_option_id
      ? supabase.from("place_options").select("name").eq("id", trip.selected_place_option_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const dateLabel = shareDate
    ? shareDate.starts_on === shareDate.ends_on
      ? shareDate.starts_on : `${shareDate.starts_on} – ${shareDate.ends_on}`
    : undefined;
  const canComplete = trip.status === "confirmed" && !!shareDate
    && shareDate.ends_on < zonedInputValue(new Date().toISOString(), trip.timezone).slice(0, 10);

  return (
    <><SiteHeader /><main className="page">
      <div className="card dashboard-card">
        <Link href={`/groups/${trip.group_id}`} className="breadcrumb">← กลับกลุ่ม</Link>
        <header className="page-heading">
          <h1>{trip.title}</h1>
          {trip.description && <p>{trip.description}</p>}
          <div className="page-meta">
            <span className="status" data-status={trip.status}>{statusLabels[trip.status] ?? trip.status}</span>
            <span className="meta-pill">ปิดโหวต {new Date(trip.vote_deadline).toLocaleString("th-TH", { timeZone: trip.timezone })}</span>
            <span className="meta-pill">เวลา {trip.timezone}</span>
          </div>
          {trip.status === "cancelled" && <p className="form-note">เหตุผลที่ยกเลิก: {trip.cancelled_reason || "ไม่ได้ระบุ"}</p>}
        </header>
        {trip.status !== "cancelled" && <ol className="trip-journey" aria-label="ขั้นตอนของทริป">
          <li data-current={trip.status === "draft"} data-done={trip.status !== "draft"}>เตรียมตัวเลือก</li>
          <li data-current={trip.status === "voting"} data-done={["confirmed", "completed"].includes(trip.status)}>โหวตวันและสถานที่</li>
          <li data-current={trip.status === "confirmed" || trip.status === "completed"}>ยืนยันแผนและตอบรับ</li>
        </ol>}
        {pageError && <p className="form-note" role="alert">{errorMessages[pageError] ?? "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"}</p>}
        <div className="next-action" aria-label="สิ่งที่ต้องทำตอนนี้">
          <strong>สิ่งที่ต้องทำตอนนี้</strong>
          {nextAction.href ? <a href={nextAction.href}>{nextAction.text} ↓</a> : <span>{nextAction.text}</span>}
        </div>
        {!["cancelled", "completed"].includes(trip.status) && <ShareTrip
          tripId={trip.id} title={trip.title} status={trip.status}
          deadline={trip.vote_deadline} timezone={trip.timezone} dateLabel={dateLabel}
          placeName={sharePlace?.name} meetingAt={trip.meeting_at} meetingPoint={trip.meeting_point}
        />}
        <div className="trip-dashboard">
          <div className="dashboard-main">
            {!isOrganizer && myParticipation && trip.status !== "cancelled" && trip.status !== "completed" && (
              <section id="invitation-section" className="group-list trip-invitation">
                <h2>คำเชิญของคุณ</h2>
                <p>สถานะ: {invitationLabels[myParticipation.invitation_status] ?? myParticipation.invitation_status}</p>
                <p className="field-hint">การรับคำเชิญต่างจากการตอบรับแผนเดินทาง หลังยืนยันแผนแล้วคุณต้องเลือกว่าจะไปหรือไม่อีกครั้ง</p>
                {myParticipation.invitation_status !== "interested" && <form action={respondToTripInvitation}>
                  <input type="hidden" name="tripId" value={tripId} />
                  <button className="primary-button" type="submit" name="status" value="interested">
                    {myParticipation.invitation_status === "declined" ? "กลับเข้าร่วมทริป" : "รับคำเชิญ"}
                  </button>
                </form>}
                {myParticipation.invitation_status !== "declined" && <details className="danger-zone">
                  <summary>ไม่ร่วมทริป</summary>
                  <p>คะแนนโหวตและคำตอบรับแผนปัจจุบันของคุณจะถูกลบ หากกลับเข้าร่วมจะต้องตอบใหม่</p>
                  <form action={respondToTripInvitation} className="group-form">
                    <input type="hidden" name="tripId" value={tripId} />
                    <input type="hidden" name="status" value="declined" />
                    <label className="check-row"><input type="checkbox" name="confirmDecline" value="yes" required /> ยืนยันว่าไม่ร่วมทริปนี้</label>
                    <button className="secondary-button danger-button" type="submit">ไม่ร่วมทริป</button>
                  </form>
                </details>}
              </section>
            )}
            {["confirmed", "completed"].includes(trip.status) ? <>
              <ConfirmationSection trip={trip} userId={auth.claims.sub} participants={participants ?? []} groupUserIds={userIds} names={names} />
              <VotingSection trip={trip} userId={auth.claims.sub} participants={participants ?? []} groupUserIds={userIds} names={names} />
            </> : <>
              <VotingSection trip={trip} userId={auth.claims.sub} participants={participants ?? []} groupUserIds={userIds} names={names} />
              <ConfirmationSection trip={trip} userId={auth.claims.sub} participants={participants ?? []} groupUserIds={userIds} names={names} />
            </>}
          </div>
          <div className="dashboard-side">
            <section className="group-list trip-people">
              <h2>ผู้ร่วมทริป</h2>
              {participants?.length ? <ul>{participants.map((person) => <li key={person.user_id}>
                <strong>{names.get(person.user_id) ?? person.user_id.slice(0, 8)}</strong>
                <span className="participant-state" data-invitation={person.invitation_status}>{invitationLabels[person.invitation_status] ?? person.invitation_status}</span>
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
              <section className="group-list trip-add-person">
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
            {isOrganizer && trip.status !== "cancelled" && trip.status !== "completed" && (
              <CreateInvite groupId={trip.group_id} tripId={trip.id} />
            )}
            {isOrganizer && !!inviteLinks?.length && <section className="group-list trip-invites">
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
            {isOrganizer && trip.status === "draft" && <section className="group-list trip-settings">
              <h2>แก้รายละเอียดทริป</h2>
              <form action={editDraftTrip} className="group-form">
                <input type="hidden" name="tripId" value={tripId} />
                <label htmlFor="edit-trip-title">ชื่อทริป</label>
                <input id="edit-trip-title" name="title" required maxLength={160} defaultValue={trip.title} />
                <label htmlFor="edit-trip-description">รายละเอียด</label>
                <textarea id="edit-trip-description" name="description" maxLength={1000} rows={3} defaultValue={trip.description} />
                <label htmlFor="edit-trip-deadline">เวลาปิดโหวต ({trip.timezone})</label>
                <input id="edit-trip-deadline" name="deadlineLocal" type="datetime-local" required defaultValue={zonedInputValue(trip.vote_deadline, trip.timezone)} />
                <button className="primary-button" type="submit">บันทึกการแก้ไข</button>
              </form>
            </section>}
            {isOrganizer && (
              <section className="group-list trip-management">
                <h2>จัดการทริป</h2>
                {trip.status === "confirmed" && canComplete && <form action={completeTrip}>
                  <input type="hidden" name="tripId" value={tripId} />
                  <button className="secondary-button" type="submit">ทำเครื่องหมายว่าจบทริปแล้ว</button>
                </form>}
                {trip.status === "confirmed" && !canComplete && <p className="form-note">ปุ่มจบทริปจะใช้ได้หลังวันเดินทางสิ้นสุด</p>}
                {["draft", "voting", "confirmed"].includes(trip.status) && <form action={cancelTrip} className="group-form">
                  <input type="hidden" name="tripId" value={tripId} />
                  <label htmlFor="cancel-reason">เหตุผลที่ยกเลิก (ไม่บังคับ)</label>
                  <input id="cancel-reason" name="reason" maxLength={500} />
                  <label className="check-row"><input type="checkbox" name="confirmCancel" value="yes" required /> ยืนยันว่าต้องการยกเลิกทริปนี้ ผู้ร่วมทริปจะโหวตหรือตอบรับไม่ได้อีก</label>
                  <button className="text-button danger" type="submit">ยกเลิกทริป</button>
                </form>}
                {["draft", "cancelled", "completed"].includes(trip.status) && <details className="danger-zone">
                  <summary>ลบทริปถาวร</summary>
                  <p>การลบจะลบคำตอบและประวัติแจ้งเตือนของทริป กู้คืนจากหน้าเว็บไม่ได้</p>
                  <form action={deleteTrip} className="group-form">
                    <input type="hidden" name="tripId" value={tripId} />
                    <label htmlFor="delete-trip-confirmation">พิมพ์ชื่อทริป “{trip.title}” เพื่อยืนยัน</label>
                    <input id="delete-trip-confirmation" name="confirmation" required autoComplete="off" />
                    <button className="secondary-button danger-button" type="submit">ลบทริปถาวร</button>
                  </form>
                </details>}
              </section>
            )}
          </div>
        </div>
      </div>
    </main></>
  );
}

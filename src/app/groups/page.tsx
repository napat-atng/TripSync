import { redirect } from "next/navigation";
import Link from "next/link";
import { createGroup } from "@/features/groups/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, description")
    .order("created_at", { ascending: false });
  const [
    { data: trips, error: tripsError },
    { data: invitations, error: invitationsError },
    { data: submissions, error: submissionsError },
    { data: rsvps, error: rsvpsError },
  ] = await Promise.all([
    supabase.from("trips")
      .select("id, group_id, title, status, organizer_id, vote_deadline, plan_version")
      .order("created_at", { ascending: false }),
    supabase.from("trip_participants").select("trip_id, invitation_status")
      .eq("user_id", data.claims.sub),
    supabase.from("vote_submissions").select("trip_id, date_submitted_at, place_submitted_at")
      .eq("user_id", data.claims.sub),
    supabase.from("trip_rsvps").select("trip_id, plan_version")
      .eq("user_id", data.claims.sub),
  ]);
  const groupNames = new Map(groups?.map((group) => [group.id, group.name]));
  const invitationByTrip = new Map(invitations?.map((item) => [item.trip_id, item.invitation_status]));
  const submissionByTrip = new Map(submissions?.map((item) => [item.trip_id, item]));
  const rsvpKeys = new Set(rsvps?.map((item) => `${item.trip_id}:${item.plan_version}`));
  const now = Date.now();
  const pendingTrips = (trips ?? []).flatMap((trip) => {
    const invitation = invitationByTrip.get(trip.id);
    const isOrganizer = trip.organizer_id === data.claims.sub;
    const submission = submissionByTrip.get(trip.id);
    let action = "";
    if (trip.status === "draft") {
      if (isOrganizer) action = "เพิ่มตัวเลือกและเปิดโหวต";
      else if (invitation === "pending") action = "ตอบคำเชิญ";
    } else if (trip.status === "voting") {
      if (new Date(trip.vote_deadline).getTime() <= now) {
        if (isOrganizer) action = "สรุปผลโหวต";
      } else if (invitation && invitation !== "declined"
          && (!submission?.date_submitted_at || !submission?.place_submitted_at)) {
        action = "โหวตวันและสถานที่";
      }
    } else if (trip.status === "confirmed" && invitation && invitation !== "declined"
        && !rsvpKeys.has(`${trip.id}:${trip.plan_version}`)) {
      action = "ตอบรับแผนล่าสุด";
    }
    return action ? [{ ...trip, action }] : [];
  });
  const overviewError = tripsError || invitationsError || submissionsError || rsvpsError;
  const { error: pageError } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="card dashboard-card">
          <header className="page-heading">
            <h1>กลุ่มของฉัน</h1>
            <p>รวมเพื่อนที่เที่ยวด้วยกัน แล้วเริ่มวางแผนทริปใหม่ได้จากแต่ละกลุ่ม</p>
          </header>
          <section className="group-list overview-section" aria-label="งานที่รอคุณ">
            <div className="section-heading"><h2>งานที่รอคุณ</h2><p>{pendingTrips.length} รายการ</p></div>
            {overviewError ? <p role="alert">โหลดงานที่รอคุณไม่สำเร็จ กรุณาเปิดหน้านี้อีกครั้ง</p>
              : pendingTrips.length ? <ul className="overview-list">{pendingTrips.map((trip) =>
              <li key={trip.id}>
                <span>{groupNames.get(trip.group_id) ?? "กลุ่มของคุณ"}</span>
                <Link href={`/trips/${trip.id}`}><strong>{trip.title}</strong></Link>
                <span>{trip.action}</span>
              </li>
            )}</ul> : <div className="empty-state"><p>ตอนนี้ไม่มีทริปที่ต้องตอบ รอดูคำเชิญหรือเริ่มทริปใหม่ได้เลย</p></div>}
          </section>
          <div className="layout-grid">
            <section aria-label="รายการกลุ่ม" className="group-list">
              <div className="section-heading"><h2>กลุ่มที่เข้าร่วม</h2><p>{groups?.length ?? 0} กลุ่ม</p></div>
              {groupsError ? <p role="alert">โหลดกลุ่มไม่สำเร็จ กรุณาลองใหม่</p> : groups?.length ? (
                <ul>{groups.map((group) => <li key={group.id}><Link href={`/groups/${group.id}`}><strong>{group.name} →</strong></Link>{group.description && <span>{group.description}</span>}</li>)}</ul>
              ) : <div className="empty-state"><p>ยังไม่มีกลุ่ม สร้างกลุ่มแรกเพื่อเริ่มชวนเพื่อนวางแผนทริป</p></div>}
            </section>
            <section className="group-list">
              <h2>สร้างกลุ่มใหม่</h2>
              <p className="section-intro">ตั้งชื่อกลุ่มที่เพื่อนจะจำได้ง่าย</p>
              <form action={createGroup} className="group-form">
                <label htmlFor="group-name">ชื่อกลุ่ม</label>
                <input id="group-name" name="name" required maxLength={120} placeholder="เช่น เพื่อนมหาวิทยาลัย" />
                <label htmlFor="group-description">คำอธิบาย (ไม่บังคับ)</label>
                <textarea id="group-description" name="description" maxLength={1000} rows={3} placeholder="กลุ่มนี้สำหรับเที่ยวแบบไหน" />
                <button className="primary-button" type="submit">สร้างกลุ่ม</button>
              </form>
              {pageError && <p className="form-note" role="alert">{pageError === "invalid" ? "กรุณาตรวจชื่อและคำอธิบายกลุ่ม" : "สร้างกลุ่มไม่สำเร็จ กรุณาลองอีกครั้ง"}</p>}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

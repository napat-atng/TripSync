import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateInvite } from "@/components/CreateInvite";
import { revokeInvite } from "@/features/access/invite-actions";
import { createTrip } from "@/features/trips/actions";
import { deleteGroup, leaveGroup, manageGroupMember, transferOrganizer, updateGroup } from "@/features/groups/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { groupId } = await params;
  const { error: pageError } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/groups/${groupId}`)}`);
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, description")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError || !group) notFound();
  const [{ data: membership }, { data: members }, { data: trips }] = await Promise.all([
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", auth.claims.sub).maybeSingle(),
    supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
    supabase.from("trips").select("id, title, status, organizer_id").eq("group_id", groupId).order("created_at", { ascending: false }),
  ]);
  const memberIds = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", memberIds)
    : { data: [] };
  const names = new Map(profiles?.map((profile) => [profile.user_id, profile.display_name]));
  const { data: inviteLinks } = membership?.role === "admin"
    ? await supabase.from("invite_links")
        .select("id, expires_at, revoked_at")
        .eq("group_id", groupId)
        .is("trip_id", null)
        .order("created_at", { ascending: false })
    : { data: null };
  const hasActiveTrips = trips?.some((trip) => ["voting", "confirmed"].includes(trip.status)) ?? false;

  return (
    <><SiteHeader /><main className="page">
      <div className="card dashboard-card">
        <Link href="/groups" className="breadcrumb">← กลุ่มของฉัน</Link>
        <header className="page-heading">
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
          <div className="page-meta"><span className="meta-pill">สมาชิก {members?.length ?? 0} คน</span><span className="meta-pill">ทริป {trips?.length ?? 0} ทริป</span></div>
        </header>
        {pageError === "revoke" && <p className="form-note" role="alert">ยกเลิกลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
        {pageError === "group" && <p className="form-note" role="alert">แก้ข้อมูลกลุ่มไม่สำเร็จ</p>}
        {pageError === "member" && <p className="form-note" role="alert">จัดการสมาชิกไม่สำเร็จ อาจเป็น admin คนสุดท้าย หรือยังเป็นผู้จัดทริปที่ไม่จบ</p>}
        {pageError === "transfer" && <p className="form-note" role="alert">โอนผู้จัดทริปไม่สำเร็จ</p>}
        {pageError === "leave" && <p className="form-note" role="alert">ออกจากกลุ่มไม่ได้ หากเป็นผู้ดูแลคนสุดท้ายหรือยังจัดทริปที่ไม่จบ ให้โอนหน้าที่ก่อน</p>}
        {pageError === "delete" && <p className="form-note" role="alert">ลบกลุ่มไม่ได้ กรุณายกเลิกทริปที่กำลังโหวตหรือยืนยันอยู่ก่อน</p>}
        {pageError === "delete-confirmation" && <p className="form-note" role="alert">ชื่อกลุ่มที่พิมพ์เพื่อยืนยันไม่ตรงกัน</p>}
        <div className="group-dashboard">
          <div className="dashboard-main">
            <section className="group-list group-trips">
              <h2>ทริปของกลุ่ม</h2>
              {trips?.length ? (
                <ul>{trips.map((trip) => <li key={trip.id}>
                  <Link href={`/trips/${trip.id}`}><strong>{trip.title}</strong></Link>
                  <span>{({ draft: "กำลังเตรียม", voting: "กำลังโหวต", confirmed: "ยืนยันแผนแล้ว", completed: "จบทริปแล้ว", cancelled: "ยกเลิกแล้ว" } as Record<string, string>)[trip.status] ?? trip.status} · ผู้จัด {names.get(trip.organizer_id) ?? trip.organizer_id.slice(0, 8)}</span>
                  {membership?.role === "admin" && ["draft", "voting", "confirmed"].includes(trip.status) && (members?.length ?? 0) > 1 && (
                    <form action={transferOrganizer} className="inline-actions">
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="tripId" value={trip.id} />
                      <select name="userId" aria-label={`ผู้จัดคนใหม่ของ ${trip.title}`} required>
                        {members?.filter((member) => member.user_id !== trip.organizer_id).map((member) => (
                          <option key={member.user_id} value={member.user_id}>{names.get(member.user_id) ?? member.user_id.slice(0, 8)}</option>
                        ))}
                      </select>
                      <button className="text-button" type="submit">โอนผู้จัด</button>
                    </form>
                  )}
                </li>)}</ul>
              ) : <div className="empty-state"><p>ยังไม่มีทริปในกลุ่มนี้ สร้างทริปแรกจากแบบฟอร์มในหน้านี้</p></div>}
            </section>
            <section className="group-list group-members">
              <h2>สมาชิกกลุ่ม</h2>
              <ul>{members?.map((member) => <li key={member.user_id}>
                <strong>{names.get(member.user_id) ?? member.user_id.slice(0, 8)}</strong>
                <span>{member.role === "admin" ? "ผู้ดูแล" : "สมาชิก"}</span>
                {membership?.role === "admin" && <>
                  <form action={manageGroupMember}>
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="userId" value={member.user_id} />
                    <button className="text-button" type="submit" name="action" value={member.role === "admin" ? "demote" : "promote"}>
                      {member.role === "admin" ? "ลดเป็นสมาชิก" : "ตั้งเป็นผู้ดูแล"}
                    </button>
                  </form>
                  {member.user_id !== auth.claims.sub && <details>
                    <summary>นำออกจากกลุ่ม</summary>
                    <form action={manageGroupMember} className="group-form">
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="userId" value={member.user_id} />
                      <input type="hidden" name="action" value="remove" />
                      <label className="check-row"><input type="checkbox" name="confirmRemove" value="yes" required /> ยืนยันการนำออก คำตอบทริปของสมาชิกคนนี้ในกลุ่มจะถูกลบ</label>
                      <button className="secondary-button danger-button" type="submit">นำออกจากกลุ่ม</button>
                    </form>
                  </details>}
                </>}
              </li>)}</ul>
            </section>
          </div>
          <div className="dashboard-side">
            <section className="group-list group-create-trip">
              <h2>สร้างทริป</h2>
              <p className="section-intro">เริ่มจากชื่อทริปและกำหนดเวลาปิดโหวต แล้วค่อยเพิ่มวันกับสถานที่ในหน้าทริป</p>
              <form action={createTrip} className="group-form">
                <input type="hidden" name="groupId" value={groupId} />
                <label htmlFor="trip-title">ชื่อทริป</label>
                <input id="trip-title" name="title" required maxLength={160} placeholder="เช่น เที่ยวทะเลเดือนหน้า" />
                <label htmlFor="trip-description">รายละเอียด (ไม่บังคับ)</label>
                <textarea id="trip-description" name="description" maxLength={1000} rows={3} />
                <label htmlFor="trip-timezone">เขตเวลาของทริป (IANA)</label>
                <input id="trip-timezone" name="timezone" list="trip-timezones" required defaultValue="Asia/Bangkok" placeholder="เช่น Asia/Bangkok" />
                <p className="field-hint">ใช้เขตเวลาของสถานที่เที่ยว เช่น Asia/Bangkok</p>
                <datalist id="trip-timezones">
                  <option value="Asia/Bangkok" />
                  <option value="Asia/Tokyo" />
                  <option value="Asia/Singapore" />
                  <option value="Europe/London" />
                  <option value="America/New_York" />
                </datalist>
                <label htmlFor="trip-deadline">เวลาปิดโหวต (ตามเขตเวลาของทริป)</label>
                <input id="trip-deadline" name="deadlineLocal" type="datetime-local" required />
                <button className="primary-button" type="submit">สร้างทริป</button>
              </form>
              {pageError === "trip" && <p className="form-note" role="alert">สร้างทริปไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่</p>}
              {pageError === "deadline" && <p className="form-note" role="alert">เวลาปิดโหวตต้องอยู่ในอนาคตและตรงกับเขตเวลาที่เลือก</p>}
            </section>
            {membership?.role === "admin" && <CreateInvite groupId={group.id} />}
            {membership?.role === "admin" && !!inviteLinks?.length && (
              <section className="group-list group-invites">
                <h2>ลิงก์เชิญที่สร้างไว้</h2>
                <ul>{inviteLinks.map((link) => {
                  const active = !link.revoked_at;
                  return <li key={link.id}>
                    <strong>{active ? "ยังไม่เพิกถอน" : "ยกเลิกแล้ว"}</strong>
                    <span>หมดอายุ {new Date(link.expires_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                    {active && <form action={revokeInvite}>
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="inviteId" value={link.id} />
                      <button className="text-button" type="submit">ยกเลิกลิงก์นี้</button>
                    </form>}
                  </li>;
                })}</ul>
              </section>
            )}
            {membership?.role === "admin" && <section className="group-list group-settings">
              <h2>แก้ข้อมูลกลุ่ม</h2>
              <form action={updateGroup} className="group-form">
                <input type="hidden" name="groupId" value={groupId} />
                <label htmlFor="group-name">ชื่อกลุ่ม</label>
                <input id="group-name" name="name" required maxLength={120} defaultValue={group.name} />
                <label htmlFor="group-description">รายละเอียด</label>
                <textarea id="group-description" name="description" maxLength={1000} rows={3} defaultValue={group.description} />
                <button className="primary-button" type="submit">บันทึกข้อมูลกลุ่ม</button>
              </form>
            </section>}
            <section className="group-list group-lifecycle">
              <h2>การเป็นสมาชิกและข้อมูลกลุ่ม</h2>
              <p className="section-intro">ออกจากกลุ่มแล้วคุณจะไม่เห็นทริปของกลุ่ม และคำตอบทริปของคุณในกลุ่มจะถูกลบ</p>
              <form action={leaveGroup} className="group-form">
                <input type="hidden" name="groupId" value={groupId} />
                <label className="check-row"><input type="checkbox" name="confirmLeave" value="yes" required /> เข้าใจและต้องการออกจากกลุ่ม</label>
                <button className="secondary-button" type="submit">ออกจากกลุ่ม</button>
              </form>
              {membership?.role === "admin" && <details className="danger-zone">
                <summary>ลบกลุ่มถาวร</summary>
                <p>การลบกลุ่มจะลบทริป คำตอบ และลิงก์เชิญทั้งหมดของกลุ่ม กู้คืนจากหน้าเว็บไม่ได้</p>
                {hasActiveTrips ? <p>ยกเลิกทริปที่กำลังโหวตหรือยืนยันอยู่ก่อน จึงจะลบกลุ่มได้</p> : (
                  <form action={deleteGroup} className="group-form">
                    <input type="hidden" name="groupId" value={groupId} />
                    <label htmlFor="delete-group-confirmation">พิมพ์ชื่อกลุ่ม “{group.name}” เพื่อยืนยัน</label>
                    <input id="delete-group-confirmation" name="confirmation" required autoComplete="off" />
                    <button className="secondary-button danger-button" type="submit">ลบกลุ่มถาวร</button>
                  </form>
                )}
              </details>}
            </section>
          </div>
        </div>
      </div>
    </main></>
  );
}

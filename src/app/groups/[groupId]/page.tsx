import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateGroupInvite } from "@/components/CreateGroupInvite";
import { revokeGroupInvite } from "@/features/access/invite-actions";
import { createTrip } from "@/features/trips/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
    supabase.from("trips").select("id, title, status").eq("group_id", groupId).order("created_at", { ascending: false }),
  ]);
  const { data: inviteLinks } = membership?.role === "admin"
    ? await supabase.from("invite_links")
        .select("id, expires_at, revoked_at")
        .eq("group_id", groupId)
        .is("trip_id", null)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <main className="page">
      <div className="card dashboard-card">
        <Link href="/groups" className="text-link">← กลุ่มของฉัน</Link>
        <h1>{group.name}</h1>
        {group.description && <p>{group.description}</p>}
        <p>สมาชิก {members?.length ?? 0} คน</p>
        {pageError === "revoke" && <p className="form-note" role="alert">ยกเลิกลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
        {membership?.role === "admin" && <CreateGroupInvite groupId={group.id} />}
        {membership?.role === "admin" && !!inviteLinks?.length && (
          <section className="group-list">
            <h2>ลิงก์เชิญที่สร้างไว้</h2>
            <ul>{inviteLinks.map((link) => {
              const active = !link.revoked_at;
              return <li key={link.id}>
                <strong>{active ? "ยังไม่เพิกถอน" : "ยกเลิกแล้ว"}</strong>
                <span>หมดอายุ {new Date(link.expires_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                {active && <form action={revokeGroupInvite}>
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="inviteId" value={link.id} />
                  <button className="text-button" type="submit">ยกเลิกลิงก์นี้</button>
                </form>}
              </li>;
            })}</ul>
          </section>
        )}
        <section className="group-list">
          <h2>สร้างทริป</h2>
          <form action={createTrip} className="group-form">
            <input type="hidden" name="groupId" value={groupId} />
            <label htmlFor="trip-title">ชื่อทริป</label>
            <input id="trip-title" name="title" required maxLength={160} placeholder="เช่น เที่ยวทะเลเดือนหน้า" />
            <label htmlFor="trip-description">รายละเอียด (ไม่บังคับ)</label>
            <textarea id="trip-description" name="description" maxLength={1000} rows={3} />
            <label htmlFor="trip-deadline">เวลาปิดโหวต (เวลาไทย)</label>
            <input id="trip-deadline" name="deadlineLocal" type="datetime-local" required />
            <button className="primary-button" type="submit">สร้างทริป</button>
          </form>
          {pageError === "trip" && <p className="form-note" role="alert">สร้างทริปไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่</p>}
          {pageError === "deadline" && <p className="form-note" role="alert">เวลาปิดโหวตต้องอยู่ในอนาคต</p>}
        </section>
        <section className="group-list">
          <h2>ทริปของกลุ่ม</h2>
          {trips?.length ? (
            <ul>{trips.map((trip) => <li key={trip.id}><Link href={`/trips/${trip.id}`}><strong>{trip.title}</strong></Link><span>{trip.status}</span></li>)}</ul>
          ) : <p>ยังไม่มีทริปในกลุ่มนี้</p>}
        </section>
      </div>
    </main>
  );
}

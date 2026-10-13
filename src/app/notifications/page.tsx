import Link from "next/link";
import { redirect } from "next/navigation";
import { markNotificationRead } from "@/features/notifications/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

const labels: Record<string, string> = {
  invited: "มีคำเชิญเข้าร่วมทริป",
  voting_opened: "เปิดโหวตแล้ว",
  confirmed: "ผู้จัดยืนยันแผนแล้ว",
  plan_changed: "แผนเปลี่ยนแล้ว กรุณาตอบรับใหม่",
  cancelled: "ทริปถูกยกเลิก",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fnotifications");
  const [{ data: events, error: eventsError }, { data: reads }] = await Promise.all([
    supabase.from("trip_events").select("id, trip_id, event_type, created_at")
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("notification_reads").select("event_id").eq("user_id", auth.claims.sub),
  ]);
  const tripIds = [...new Set(events?.map((event) => event.trip_id) ?? [])];
  const { data: trips } = tripIds.length
    ? await supabase.from("trips").select("id, title").in("id", tripIds)
    : { data: [] };
  const tripNames = new Map(trips?.map((trip) => [trip.id, trip.title]));
  const readIds = new Set(reads?.map((read) => read.event_id));
  const { error: pageError } = await searchParams;

  return <><SiteHeader /><main className="page"><div className="card dashboard-card">
    <Link href="/groups" className="breadcrumb">← กลุ่มของฉัน</Link>
    <header className="page-heading"><h1>แจ้งเตือน</h1><p>ติดตามคำเชิญ ผลโหวต และการเปลี่ยนแปลงของทริป</p></header>
    {pageError && <p className="form-note" role="alert">บันทึกสถานะอ่านไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
    <section className="group-list">
    {eventsError ? <p role="alert">โหลดแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่</p> : events?.length ? (
      <ul className="notification-list">{events.map((event) => <li key={event.id} data-unread={!readIds.has(event.id)}>
        <Link href={`/trips/${event.trip_id}`}><strong>{tripNames.get(event.trip_id) ?? "ทริป"}</strong></Link>
        <span>{labels[event.event_type] ?? event.event_type}</span>
        <span>{new Date(event.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
        {!readIds.has(event.id) && <form action={markNotificationRead}>
          <input type="hidden" name="eventId" value={event.id} />
          <button className="text-button" type="submit">ทำเครื่องหมายว่าอ่าน</button>
        </form>}
      </li>)}</ul>
    ) : <div className="empty-state"><p>ยังไม่มีแจ้งเตือน เมื่อเพื่อนชวนหรือแผนเปลี่ยน รายการจะปรากฏที่นี่</p></div>}
    </section>
  </div></main></>;
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/trips/${tripId}`)}`);
  }

  const { data: trip, error } = await supabase.from("trips")
    .select("id, group_id, title, description, status, vote_deadline, timezone, organizer_id")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) notFound();

  return (
    <main className="page">
      <div className="card dashboard-card">
        <Link href={`/groups/${trip.group_id}`} className="text-link">← กลับกลุ่ม</Link>
        <h1>{trip.title}</h1>
        {trip.description && <p>{trip.description}</p>}
        <p>สถานะ: {trip.status === "draft" ? "กำลังเตรียมตัวเลือก" : trip.status}</p>
        <p>ปิดโหวต: {new Date(trip.vote_deadline).toLocaleString("th-TH", { timeZone: trip.timezone })}</p>
        <p>กำลังเพิ่มตัวเลือกวัน สถานที่ และระบบโหวต</p>
      </div>
    </main>
  );
}

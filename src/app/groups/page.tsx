import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function GroupsPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/?next=%2Fgroups");

  return (
    <main className="page">
      <div className="card">
        <div className="brand">TripSync</div>
        <h1>กลุ่มของฉัน</h1>
        <p>เข้าสู่ระบบแล้ว ขั้นถัดไปคือสร้างกลุ่มและชวนเพื่อนเข้าร่วม</p>
        <form action="/auth/sign-out" method="post">
          <button className="text-button" type="submit">ออกจากระบบ</button>
        </form>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createGroup } from "@/features/groups/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/?next=%2Fgroups");
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, description")
    .order("created_at", { ascending: false });
  const { error: pageError } = await searchParams;

  return (
    <main className="page">
      <div className="card dashboard-card">
        <div className="brand">TripSync</div>
        <h1>กลุ่มของฉัน</h1>
        <p>สร้างกลุ่มเพื่อเริ่มวางแผนทริปกับเพื่อน</p>
        <form action={createGroup} className="group-form">
          <label htmlFor="group-name">ชื่อกลุ่ม</label>
          <input id="group-name" name="name" required maxLength={120} placeholder="เช่น เพื่อนมหาวิทยาลัย" />
          <label htmlFor="group-description">คำอธิบาย (ไม่บังคับ)</label>
          <textarea id="group-description" name="description" maxLength={1000} rows={3} />
          <button className="primary-button" type="submit">สร้างกลุ่ม</button>
        </form>
        {pageError && <p className="form-note" role="alert">{pageError === "invalid" ? "กรุณาตรวจชื่อและคำอธิบายกลุ่ม" : "สร้างกลุ่มไม่สำเร็จ กรุณาลองอีกครั้ง"}</p>}
        <section aria-label="รายการกลุ่ม" className="group-list">
          <h2>กลุ่มที่เข้าร่วม</h2>
          {groupsError ? <p>โหลดกลุ่มไม่สำเร็จ กรุณาลองใหม่</p> : groups?.length ? (
            <ul>{groups.map((group) => <li key={group.id}><Link href={`/groups/${group.id}`}><strong>{group.name}</strong></Link>{group.description && <span>{group.description}</span>}</li>)}</ul>
          ) : <p>ยังไม่มีกลุ่ม เริ่มจากสร้างกลุ่มแรกด้านบน</p>}
        </section>
        <form action="/auth/sign-out" method="post">
          <button className="text-button" type="submit">ออกจากระบบ</button>
        </form>
      </div>
    </main>
  );
}

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
  if (error || !data?.claims) redirect("/?next=%2Fgroups");
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, description")
    .order("created_at", { ascending: false });
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

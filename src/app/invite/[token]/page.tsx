import { redirect } from "next/navigation";
import { acceptInvite } from "@/features/access/invite-actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";

const statusText: Record<string, string> = {
  not_found: "ไม่พบลิงก์เชิญนี้",
  revoked: "ลิงก์เชิญนี้ถูกยกเลิกแล้ว",
  expired: "ลิงก์เชิญนี้หมดอายุแล้ว",
  closed: "ทริปนี้ปิดรับสมาชิกแล้ว",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: acceptError } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data, error } = await supabase.rpc("preview_invite", { p_token: token });
  const preview = data?.[0];
  const status = error ? "not_found" : (preview?.invite_status ?? "not_found");

  return (
    <><SiteHeader /><main className="page">
      <div className="auth-card">
        <h1>{status === "valid" ? "คำเชิญเข้าร่วม" : "ลิงก์เชิญใช้ไม่ได้"}</h1>
        {status === "valid" ? (
          <>
            <div className="confirmed-plan">
              <p>กลุ่ม: <strong>{preview.group_name}</strong></p>
              {preview.trip_title && <p>ทริป: <strong>{preview.trip_title}</strong></p>}
            </div>
            <p>ตรวจชื่อกลุ่มและทริปก่อนเข้าร่วม เมื่อยืนยันแล้วคุณจะเห็นแผนและร่วมโหวตได้</p>
            <form action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <button className="primary-button" type="submit">ยืนยันเข้าร่วม</button>
            </form>
            {acceptError && <p className="form-note" role="alert">เข้าร่วมไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
          </>
        ) : <><p>{statusText[status] ?? statusText.not_found}</p><Link href="/groups" className="secondary-button">กลับไปกลุ่มของฉัน</Link></>}
      </div>
    </main></>
  );
}

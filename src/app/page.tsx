import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { safeNextPath } from "@/features/access/safe-next-path";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="page">
      <div className="card">
        <div className="hero">
          <div className="hero-copy">
            <div className="brand"><span className="brand-mark" aria-hidden="true" /> TripSync</div>
            <h1>นัดทริปให้<br />ลงตัวทั้งกลุ่ม</h1>
            <p>ชวนเพื่อน เลือกวัน โหวตสถานที่ แล้วเห็นทันทีว่าใครว่าง ใครยังไม่ตอบ และแผนล่าสุดคืออะไร</p>
            <GoogleSignInButton nextPath={safeNextPath(next)} />
            <span className="hero-footnote">เริ่มวางแผนด้วยบัญชี Google</span>
          </div>
          <div className="hero-preview" aria-label="ตัวอย่างหน้าสรุปผลโหวต">
            <div className="preview-top"><span>ตัวอย่างการวางแผน</span><span className="preview-dots" aria-hidden="true"><i /><i /><i /></span></div>
            <div className="preview-body">
              <div className="preview-title"><strong>ทริปเชียงใหม่</strong><span>กำลังโหวต</span></div>
              <p>วันไหนที่เพื่อนว่างตรงกัน?</p>
              <div className="preview-option"><span>21–23 พ.ย.</span><strong>4 คนว่าง</strong><div className="preview-bar"><i style={{ width: "80%" }} /></div></div>
              <div className="preview-option"><span>28–30 พ.ย.</span><strong>2 คนว่าง</strong><div className="preview-bar"><i style={{ width: "40%" }} /></div></div>
              <div className="preview-people"><span>ตอบแล้ว 4/5 คน</span><span>รอเพื่อนอีก 1 คน</span></div>
            </div>
          </div>
        </div>
        <div className="hero-steps" aria-label="วิธีใช้ TripSync">
          <div><strong>เริ่มจากกลุ่มเพื่อน</strong><p>รวมคนที่อยากไปด้วยกันในลิงก์เดียว</p></div>
          <div><strong>หาวันที่ตรงกัน</strong><p>ทุกคนตอบวันและสถานที่ที่สะดวก</p></div>
          <div><strong>ยืนยันแล้วไปกัน</strong><p>แผนล่าสุดและคำตอบรับอยู่ที่เดียวกัน</p></div>
        </div>
      </div>
    </main>
  );
}

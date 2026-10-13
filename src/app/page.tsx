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
          <div>
            <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span> TripSync</div>
            <h1>ทริปลงตัว เมื่อทุกคนได้ออกเสียง</h1>
            <p>ชวนเพื่อน เลือกวันที่สะดวก โหวตสถานที่ แล้วดูแผนที่ตกลงกันได้ในหน้าเดียว</p>
            <GoogleSignInButton nextPath={safeNextPath(next)} />
          </div>
          <div className="hero-art" aria-hidden="true"><span>✦</span></div>
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

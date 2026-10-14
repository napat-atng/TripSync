import Link from "next/link";

export default function NotFound() {
  return <main className="page"><div className="auth-card">
    <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span> WePlanGo</div>
    <h1>ไม่พบหน้านี้</h1>
    <p>ลิงก์อาจไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เปิดหน้านี้</p>
    <Link href="/groups" className="secondary-button">กลับไปหน้ากลุ่ม</Link>
  </div></main>;
}

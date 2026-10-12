import Link from "next/link";

export default function NotFound() {
  return <main className="page"><div className="card">
    <div className="brand">TripSync</div>
    <h1>ไม่พบหน้านี้</h1>
    <p>ลิงก์อาจไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เปิดหน้านี้</p>
    <Link href="/groups" className="text-link">กลับไปหน้ากลุ่ม</Link>
  </div></main>;
}

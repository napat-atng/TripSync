"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page"><div className="auth-card">
    <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span> TripSync</div>
    <h1>โหลดหน้าไม่สำเร็จ</h1>
    <p>ลองเปิดหน้านี้อีกครั้ง หากยังมีปัญหาให้กลับไปหน้ากลุ่ม</p>
    <button className="primary-button" type="button" onClick={reset}>ลองอีกครั้ง</button>
    <p><Link href="/groups" className="text-link">กลับไปหน้ากลุ่ม</Link></p>
  </div></main>;
}

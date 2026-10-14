import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="page">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span> WePlanGo</div>
        <h1>เข้าสู่ระบบไม่สำเร็จ</h1>
        <p>กรุณาลองเข้าสู่ระบบด้วย Google อีกครั้ง</p>
        <Link href="/" className="secondary-button">กลับหน้าแรก</Link>
      </div>
    </main>
  );
}

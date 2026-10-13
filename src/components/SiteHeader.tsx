import Link from "next/link";

export function SiteHeader({ signedIn = true }: { signedIn?: boolean }) {
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href={signedIn ? "/groups" : "/"} className="brand" aria-label="TripSync หน้าแรก">
        <span className="brand-mark" aria-hidden="true">↗</span> TripSync
      </Link>
      {signedIn && <nav className="site-nav" aria-label="เมนูหลัก">
        <Link href="/groups">กลุ่มของฉัน</Link>
        <Link href="/notifications">แจ้งเตือน</Link>
        <form action="/auth/sign-out" method="post"><button className="text-button" type="submit">ออกจากระบบ</button></form>
      </nav>}
    </div>
  </header>;
}

import { Link, NavLink, Outlet } from "react-router-dom";
import { Alert, Container, Group, Text } from "@mantine/core";
import { MapPinned, Compass, UserRound } from "lucide-react";
import { useOnline } from "../shared/useOnline";
import { PwaControls } from "./PwaControls";

const links = [{ to: "/", label: "ทริปของฉัน", icon: Compass }, { to: "/profile", label: "โปรไฟล์", icon: UserRound }];
function Navigation({ mobile = false }: { mobile?: boolean }) {
  return <nav className={mobile ? "bottom-navigation" : "side-navigation"} aria-label={mobile ? "เมนูหลักบนมือถือ" : "เมนูหลัก"}>
    {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end className={({ isActive }) => `navigation-link${isActive ? " active" : ""}`}><Icon size={22} aria-hidden="true" /><span>{label}</span></NavLink>)}
  </nav>;
}
export function AppShell() {
  const online = useOnline();
  return <><a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหา</a>
    <aside className="sidebar"><Link to="/" className="brand-link"><MapPinned size={28} aria-hidden="true" /><span>TripSync</span></Link><Text size="sm" c="dimmed" mt="xs" mb="xl">วางแผนเที่ยวด้วยกัน</Text><Navigation /><Text className="sidebar-note" size="sm" c="dimmed">ทุกไอเดีย มีที่ในทริป</Text></aside>
    <header className="mobile-header"><Group gap="xs"><MapPinned size={24} /><Text fw={700}>TripSync</Text></Group></header>
    <main id="main-content" className="main-content" tabIndex={-1}><Container size={1120}>
      {!online ? <Alert color="yellow" title="คุณกำลังออฟไลน์" role="status" mb="lg">เชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลและบันทึกการเปลี่ยนแปลง</Alert> : null}
      <PwaControls /><Outlet />
    </Container></main><Navigation mobile />
  </>;
}

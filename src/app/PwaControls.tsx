import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useDirtyForms } from "./DirtyFormsProvider";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaControls() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [error, setError] = useState(false);
  const { dirty } = useDirtyForms();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setError(true) });
  useEffect(() => {
    function available(event: Event) { event.preventDefault(); setInstallEvent(event as InstallEvent); }
    function installed() { setInstallEvent(null); }
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", available); window.removeEventListener("appinstalled", installed); };
  }, []);
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!needRefresh && !installEvent && !error && (!ios || standalone)) return null;
  return <Stack gap="sm" mb="lg">
    {needRefresh ? <Alert title="TripSync เวอร์ชันใหม่พร้อมแล้ว"><Group justify="space-between"><Text size="sm">{dirty ? "บันทึกฟอร์มก่อนอัปเดตแอป" : "อัปเดตเมื่อพร้อม หน้านี้จะโหลดใหม่"}</Text><Button disabled={dirty} onClick={() => void updateServiceWorker(true)}>อัปเดตแอป</Button></Group></Alert> : null}
    {installEvent ? <Button variant="light" onClick={() => void install()}>ติดตั้ง TripSync บนหน้าจอโฮม</Button> : null}
    {ios && !standalone ? <Text size="sm" c="dimmed">ติดตั้งบน iPhone: เปิดใน Safari แล้วเลือก แชร์ → เพิ่มไปยังหน้าจอโฮม</Text> : null}
    {error ? <Text size="sm" c="dimmed">เตรียมโหมดออฟไลน์ไม่สำเร็จ คุณยังใช้เว็บไซต์ได้ขณะออนไลน์</Text> : null}
  </Stack>;
}

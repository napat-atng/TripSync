import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button, Container, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { MapPinned } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { signInWithGoogle } from "./service";
import { configurationError } from "../../shared/supabase";
import { safeReturnPath } from "../../shared/navigation";
import { useOnline } from "../../shared/useOnline";
import { ErrorState, LoadingState } from "../../shared/feedback";

export function LoginPage() {
  const [params] = useSearchParams();
  const { session, loading, error: sessionError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const online = useOnline();
  const returnTo = safeReturnPath(params.get("returnTo"));
  if (loading) return <LoadingState />;
  if (session) return <Navigate to={returnTo} replace />;
  async function login() {
    setPending(true); setError(null);
    try { await signInWithGoogle(returnTo); }
    catch { setError("เริ่มเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง"); setPending(false); }
  }
  return <Container size="sm" className="login-page"><Stack gap="xl">
    <Paper className="hero-card" p="xl" radius="xl">
      <ThemeIcon size={56} radius="lg" variant="white" color="indigo"><MapPinned size={30} /></ThemeIcon>
      <Text mt="xl" className="brand">TripSync</Text>
      <Title order={1} mt="sm">ทริปที่ดี<br />เริ่มจากวางแผนด้วยกัน</Title>
      <Text mt="md" c="gray.2">รวมวันว่าง เลือกแผนที่ทุกคนชอบ แล้วออกเดินทางไปด้วยกัน</Text>
    </Paper>
    <Paper p="xl" radius="xl" withBorder><Stack>
      <Title order={2} size="h3">เข้ามาวางแผนทริปของคุณ</Title>
      <Text c="dimmed" size="sm">ใช้บัญชี Google เพื่อสร้างห้องหรือเข้าร่วมทริปกับเพื่อน</Text>
      {configurationError || sessionError || error ? <ErrorState message={configurationError ?? sessionError ?? error ?? ""} /> : null}
      <Button fullWidth size="md" loading={pending} disabled={!online || !!configurationError} onClick={() => void login()}>เข้าสู่ระบบด้วย Google</Button>
      {!online ? <Text role="status" c="dimmed">คุณออฟไลน์ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ</Text> : null}
    </Stack></Paper>
  </Stack></Container>;
}

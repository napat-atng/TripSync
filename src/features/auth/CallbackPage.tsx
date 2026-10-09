import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Container, Stack } from "@mantine/core";
import { completeGoogleCallback } from "./service";
import { ErrorState, LoadingState } from "../../shared/feedback";

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (params.has("error") || !code) {
      setError("การเข้าสู่ระบบถูกยกเลิกหรือลิงก์หมดอายุ กรุณาเริ่มใหม่");
      window.history.replaceState(null, "", "/auth/callback");
      return;
    }
    void completeGoogleCallback(code).then(path => {
      if (active) navigate(path, { replace: true });
    }).catch(() => {
      if (active) {
        window.history.replaceState(null, "", "/auth/callback");
        setError("ยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาเริ่มใหม่จากเบราว์เซอร์เดิม");
      }
    });
    return () => { active = false; };
  }, [navigate]);
  return <Container size="sm" py="xl">{error ? <Stack><ErrorState message={error} /><Button component={Link} to="/login">กลับไปเข้าสู่ระบบ</Button></Stack> : <LoadingState label="กำลังยืนยันการเข้าสู่ระบบ…" />}</Container>;
}

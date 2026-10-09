import { createBrowserRouter, Link, Navigate, Outlet, useLocation, useRouteError } from "react-router-dom";
import { Button, Container, Stack } from "@mantine/core";
import { useAuth } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { CallbackPage } from "../features/auth/CallbackPage";
import { EmptyState, ErrorState, LoadingState } from "../shared/feedback";
import { AppShell } from "./AppShell";
import { configurationError } from "../shared/supabase";

function ProtectedRoutes() {
  const { loading, session, error } = useAuth();
  const location = useLocation();
  if (configurationError) return <Container py="xl"><ErrorState message={configurationError} /></Container>;
  if (loading) return <LoadingState />;
  if (error) return <Container py="xl"><ErrorState message="ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ" retry={() => window.location.reload()} /></Container>;
  if (!session) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  return <Outlet />;
}
function NotFound() {
  return <Stack><EmptyState title="ไม่พบหน้านี้">ตรวจสอบลิงก์ หรือกลับไปที่ทริปของคุณ</EmptyState><Button component={Link} to="/">กลับหน้าหลัก</Button></Stack>;
}
function RouteError() {
  useRouteError();
  return <Container py="xl"><ErrorState message="เปิดหน้านี้ไม่สำเร็จ" retry={() => window.location.reload()} /></Container>;
}
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteError /> },
  { path: "/auth/callback", element: <CallbackPage />, errorElement: <RouteError /> },
  { element: <ProtectedRoutes />, hydrateFallbackElement: <LoadingState />, errorElement: <RouteError />, children: [
    { element: <AppShell />, children: [
      { index: true, lazy: async () => ({ Component: (await import("../features/trips/HomePage")).HomePage }) },
      { path: "/trips/new", lazy: async () => ({ Component: (await import("../features/trips/CreateTripPage")).CreateTripPage }) },
      { path: "/trips/:id", lazy: async () => ({ Component: (await import("../features/trips/TripPage")).TripPage }) },
      { path: "/profile", lazy: async () => ({ Component: (await import("../features/profile/ProfilePage")).ProfilePage }) },
      { path: "*", element: <NotFound /> },
    ] },
  ] },
]);

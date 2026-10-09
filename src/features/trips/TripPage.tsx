import { useParams } from "react-router-dom";
import { Badge, Paper, Stack, Text, Title } from "@mantine/core";
import { useTrip } from "./hooks";
import { EmptyState, ErrorState, LoadingState } from "../../shared/feedback";

export function TripPage() {
  const { id = "" } = useParams();
  const trip = useTrip(id);
  if (trip.isPending) return <LoadingState />;
  if (trip.isError) return <ErrorState message="โหลดห้องทริปไม่สำเร็จ" retry={() => void trip.refetch()} />;
  if (!trip.data) return <EmptyState title="ไม่พบห้อง หรือคุณไม่มีสิทธิ์เข้าถึง">ตรวจสอบลิงก์เชิญและสถานะสมาชิกของคุณ</EmptyState>;
  return <Stack><Badge>{trip.data.status === "closed" ? "ปิดทริปแล้ว" : "กำลังวางแผน"}</Badge><Title order={1} className="wrap-text">{trip.data.name}</Title><Paper p="lg" withBorder radius="lg"><Text className="wrap-text">{trip.data.description || "ห้องสำหรับวางแผนเที่ยวร่วมกัน"}</Text><Text c="dimmed" size="sm" mt="md">Timezone: {trip.data.timezone}</Text><Text c="dimmed" size="sm">การเข้าร่วม: {trip.data.join_mode === "open" ? "เข้าร่วมทันที" : "รออนุมัติ"}</Text></Paper></Stack>;
}

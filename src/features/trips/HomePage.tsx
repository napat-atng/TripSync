import { Link } from "react-router-dom";
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ArrowUpRight, Plus } from "lucide-react";
import { useTrips } from "./hooks";
import { EmptyState, ErrorState, LoadingState } from "../../shared/feedback";

export function HomePage() {
  const trips = useTrips();
  return <Stack gap="xl">
    <Paper className="hero-card" p="xl" radius="xl"><Text size="sm" c="gray.3">พื้นที่ของทุกคนในทริป</Text><Title order={1} mt="sm">นัดวันให้ลงตัว<br />แล้วไปเที่ยวด้วยกัน</Title><Text mt="md" c="gray.2">เริ่มจากห้องทริป รวมไอเดีย และวางแผนร่วมกับเพื่อน</Text></Paper>
    <Group justify="space-between"><Title order={2}>ทริปของฉัน</Title><Button component={Link} to="/trips/new" leftSection={<Plus size={18} />}>สร้างห้อง</Button></Group>
    {trips.isPending ? <LoadingState /> : trips.isError ? <ErrorState message="โหลดรายการทริปไม่สำเร็จ" retry={() => void trips.refetch()} /> : !trips.data.length ? <Paper p="xl" radius="lg" withBorder><EmptyState title="ยังไม่มีทริป">สร้างห้องแรกของคุณ หรือเข้าร่วมผ่านลิงก์เชิญจากเพื่อน</EmptyState></Paper> : <SimpleGrid cols={{ base: 1, sm: 2 }}>
      {trips.data.map(trip => <Paper key={trip.id} withBorder p="lg" radius="lg"><Stack><Badge variant="light" color={trip.status === "closed" ? "gray" : "indigo"}>{trip.status === "closed" ? "ปิดทริปแล้ว" : "กำลังวางแผน"}</Badge><Title order={3} className="wrap-text">{trip.name}</Title><Text c="dimmed" lineClamp={2}>{trip.description || "เริ่มวางแผนทริปด้วยกัน"}</Text><Button component={Link} to={`/trips/${trip.id}`} variant="light" rightSection={<ArrowUpRight size={18} />}>เปิดห้องทริป</Button></Stack></Paper>)}
    </SimpleGrid>}
  </Stack>;
}

import { Alert, Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function LoadingState({ label = "กำลังโหลด…" }: { label?: string }) {
  return <Center mih={180}><Stack align="center" role="status"><Loader aria-hidden="true" /><Text>{label}</Text></Stack></Center>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Alert color="red" title="ดำเนินการไม่สำเร็จ" role="alert"><Stack><Text>{message}</Text>{retry ? <Button variant="light" onClick={retry}>ลองอีกครั้ง</Button> : null}</Stack></Alert>;
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <Stack align="center" ta="center" py="xl"><Title order={2} size="h3">{title}</Title><Text c="dimmed">{children}</Text></Stack>;
}

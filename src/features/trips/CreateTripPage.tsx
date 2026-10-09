import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Paper, Select, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { createTrip } from "./service";
import { tripInput, type TripInput } from "./validation";
import { useOnline } from "../../shared/useOnline";
import { ErrorState } from "../../shared/feedback";
import { UnsavedChanges } from "../../shared/UnsavedChanges";

const initial: TripInput = { name: "", description: "", timezone: "Asia/Bangkok", joinMode: "open" };
export function CreateTripPage() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnline();
  const mutation = useMutation({ mutationFn: createTrip });
  useEffect(() => {
    if (createdTripId) navigate(`/trips/${createdTripId}`, { replace: true });
  }, [createdTripId, navigate]);
  function update<K extends keyof TripInput>(key: K, value: TripInput[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!online || mutation.isPending || createdTripId) return;
    const result = tripInput.safeParse(form);
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map(issue => [issue.path[0], issue.message]))); return; }
    setErrors({});
    try {
      const id = await mutation.mutateAsync(result.data);
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      setCreatedTripId(id);
    } catch { /* Mutation state renders a retryable error and keeps the draft. */ }
  }
  return <Stack><Title order={1}>สร้างห้องทริป</Title><Paper withBorder radius="lg" p="lg"><form onSubmit={event => void submit(event)}><Stack>
    <TextInput label="ชื่อทริป" required maxLength={120} value={form.name} error={errors.name} onChange={event => update("name", event.currentTarget.value)} />
    <Textarea label="คำอธิบาย" maxLength={2000} value={form.description} error={errors.description} onChange={event => update("description", event.currentTarget.value)} autosize minRows={3} />
    <TextInput label="Timezone ของห้อง" description="ใช้กำหนดวันและเวลาในทริป" required value={form.timezone} error={errors.timezone} onChange={event => update("timezone", event.currentTarget.value)} />
    <Select label="การเข้าร่วมผ่านลิงก์เชิญ" data={[{ value: "open", label: "เข้าร่วมทันที" }, { value: "approval", label: "รอหัวห้องอนุมัติ" }]} value={form.joinMode} allowDeselect={false} onChange={value => update("joinMode", value === "approval" ? "approval" : "open")} />
    {mutation.isError ? <ErrorState message="สร้างห้องไม่สำเร็จ กรุณาลองอีกครั้ง" /> : null}
    <Button type="submit" disabled={!online || !!createdTripId} loading={mutation.isPending}>สร้างห้องทริป</Button>
  </Stack></form></Paper><UnsavedChanges dirty={!createdTripId && JSON.stringify(form) !== JSON.stringify(initial)} /></Stack>;
}

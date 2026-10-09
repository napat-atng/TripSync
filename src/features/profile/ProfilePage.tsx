import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useAuth } from "../auth/AuthProvider";
import { signOut } from "../auth/service";
import { getProfile, profileInput, updateProfile } from "./service";
import { ErrorState, LoadingState } from "../../shared/feedback";
import { UnsavedChanges } from "../../shared/UnsavedChanges";
import { useOnline } from "../../shared/useOnline";

export function ProfilePage() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const online = useOnline();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const [draft, setDraft] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: (displayName: string) => updateProfile(userId, displayName) });
  const logout = useMutation({ mutationFn: signOut });
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState message="โหลดโปรไฟล์ไม่สำเร็จ" retry={() => void profile.refetch()} />;
  const name = draft ?? profile.data.display_name;
  const dirty = name !== profile.data.display_name;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!online || mutation.isPending) return;
    const result = profileInput.safeParse({ displayName: name });
    if (!result.success) { setValidationError(result.error.issues[0].message); return; }
    setValidationError(null);
    try {
      await mutation.mutateAsync(result.data.displayName);
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setDraft(null);
    } catch { /* Retain edits and expose the mutation error below. */ }
  }
  return <Stack><Title order={1}>โปรไฟล์ของฉัน</Title><Paper p="lg" withBorder radius="lg"><Stack>
    <Avatar src={profile.data.avatar_url} size={72} radius="xl" alt="รูปโปรไฟล์ของคุณ">{name.slice(0, 1)}</Avatar>
    <form onSubmit={event => void save(event)}><Stack><TextInput label="ชื่อที่แสดงในทริป" required value={name} maxLength={100} error={validationError} onChange={event => setDraft(event.currentTarget.value)} />
    {mutation.isError ? <ErrorState message="บันทึกชื่อไม่สำเร็จ กรุณาลองอีกครั้ง" /> : null}
    <Button type="submit" loading={mutation.isPending} disabled={!online || !dirty}>บันทึกโปรไฟล์</Button></Stack></form>
    <Text size="sm" c="dimmed">{session?.user.email}</Text>
    {logout.isError ? <ErrorState message="ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" /> : null}
    <Button variant="light" color="red" loading={logout.isPending} disabled={!online || dirty} onClick={() => void logout.mutate()}>ออกจากระบบ</Button>
    {dirty ? <Text size="sm" c="dimmed">บันทึกการเปลี่ยนแปลงก่อนออกจากระบบ</Text> : null}
  </Stack></Paper><UnsavedChanges dirty={dirty} /></Stack>;
}

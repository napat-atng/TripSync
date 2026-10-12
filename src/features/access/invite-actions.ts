"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type InviteActionState = { path: string | null; error: string | null };

export async function createGroupInvite(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return { path: null, error: "กลุ่มไม่ถูกต้อง" };

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) return { path: null, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (membershipError || membership?.role !== "admin") {
    return { path: null, error: "เฉพาะผู้ดูแลกลุ่มสร้างลิงก์ได้" };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("invite_links").insert({
    group_id: groupId,
    token_hash: tokenHash,
    created_by: auth.claims.sub,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return { path: null, error: "สร้างลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  return { path: `/invite/${token}`, error: null };
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/groups");

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) {
    redirect(`/?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !data?.[0]?.group_id) redirect(`/invite/${token}?error=accept`);
  redirect(`/groups/${data[0].group_id}`);
}

export async function revokeGroupInvite(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId) || !/^[0-9a-f-]{36}$/i.test(inviteId)) {
    redirect("/groups");
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: membership } = await supabase.from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (membership?.role !== "admin") redirect(`/groups/${groupId}`);

  const { data: revoked, error } = await supabase.from("invite_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("group_id", groupId)
    .is("trip_id", null)
    .is("revoked_at", null)
    .select("id");
  if (error || !revoked?.length) redirect(`/groups/${groupId}?error=revoke`);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

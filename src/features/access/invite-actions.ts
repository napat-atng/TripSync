"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type InviteActionState = { path: string | null; error: string | null };

export async function createInvite(
  _previous: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const groupId = String(formData.get("groupId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return { path: null, error: "กลุ่มไม่ถูกต้อง" };
  if (tripId && !/^[0-9a-f-]{36}$/i.test(tripId)) return { path: null, error: "ทริปไม่ถูกต้อง" };

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) return { path: null, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  if (tripId) {
    const { data: trip, error: tripError } = await supabase.from("trips")
      .select("organizer_id, group_id, status")
      .eq("id", tripId)
      .maybeSingle();
    if (tripError || trip?.organizer_id !== auth.claims.sub || trip.group_id !== groupId
        || ["cancelled", "completed"].includes(trip.status)) {
      return { path: null, error: "เฉพาะผู้จัดทริปสร้างลิงก์นี้ได้" };
    }
  } else {
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", auth.claims.sub)
      .maybeSingle();
    if (membershipError || membership?.role !== "admin") {
      return { path: null, error: "เฉพาะผู้ดูแลกลุ่มสร้างลิงก์ได้" };
    }
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("invite_links").insert({
    group_id: groupId,
    trip_id: tripId || null,
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
  if (data[0].trip_id) redirect(`/trips/${data[0].trip_id}`);
  redirect(`/groups/${data[0].group_id}`);
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId) || !/^[0-9a-f-]{36}$/i.test(inviteId)
      || (tripId && !/^[0-9a-f-]{36}$/i.test(tripId))) {
    redirect("/groups");
  }
  const destination = tripId ? `/trips/${tripId}` : `/groups/${groupId}`;

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  if (tripId) {
    const { data: trip } = await supabase.from("trips")
      .select("organizer_id, group_id")
      .eq("id", tripId)
      .maybeSingle();
    if (!trip || trip.organizer_id !== auth.claims.sub || trip.group_id !== groupId) {
      redirect(destination);
    }
  } else {
    const { data: membership } = await supabase.from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", auth.claims.sub)
      .maybeSingle();
    if (membership?.role !== "admin") redirect(destination);
  }

  const update = supabase.from("invite_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("group_id", groupId)
    .is("revoked_at", null);
  const { data: revoked, error } = tripId
    ? await update.eq("trip_id", tripId).select("id")
    : await update.is("trip_id", null).select("id");
  if (error || !revoked?.length) redirect(`${destination}?error=revoke`);
  revalidatePath(destination);
  redirect(destination);
}

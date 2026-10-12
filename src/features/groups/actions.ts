"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createGroup(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name || name.length > 120 || description.length > 1000) {
    redirect("/groups?error=invalid");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError || !data?.claims?.sub) redirect("/?next=%2Fgroups");

  const { error } = await supabase.from("groups").insert({
    name,
    description,
    created_by: data.claims.sub,
  });
  if (error) redirect("/groups?error=create");

  revalidatePath("/groups");
  redirect("/groups");
}

async function adminContext(groupId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) redirect("/groups");
  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) redirect("/?next=%2Fgroups");
  const { data: member } = await supabase.from("group_members")
    .select("role").eq("group_id", groupId).eq("user_id", auth.claims.sub).maybeSingle();
  if (member?.role !== "admin") redirect(`/groups/${groupId}`);
  return supabase;
}

export async function updateGroup(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name || name.length > 120 || description.length > 1000) {
    redirect(`/groups/${groupId}?error=group`);
  }
  const supabase = await adminContext(groupId);
  const { data, error } = await supabase.from("groups")
    .update({ name, description }).eq("id", groupId).select("id").maybeSingle();
  if (error || !data) redirect(`/groups/${groupId}?error=group`);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function manageGroupMember(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["promote", "demote", "remove"].includes(action)) {
    redirect(`/groups/${groupId}?error=member`);
  }
  const supabase = await adminContext(groupId);
  const { error } = await supabase.rpc("manage_group_member", {
    p_group_id: groupId, p_user_id: userId, p_action: action,
  });
  if (error) redirect(`/groups/${groupId}?error=member`);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function transferOrganizer(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId) || !/^[0-9a-f-]{36}$/i.test(userId)) {
    redirect(`/groups/${groupId}?error=transfer`);
  }
  const supabase = await adminContext(groupId);
  const { data: trip } = await supabase.from("trips")
    .select("id").eq("id", tripId).eq("group_id", groupId).maybeSingle();
  if (!trip) redirect(`/groups/${groupId}?error=transfer`);
  const { error } = await supabase.rpc("transfer_trip_organizer", {
    p_trip_id: tripId, p_user_id: userId,
  });
  if (error) redirect(`/groups/${groupId}?error=transfer`);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/groups/${groupId}`);
}

import { supabase } from "./supabase";
import type { UserProfile } from "../types/profile";

export async function getProfile(userId: string) {
  const { data, error } = await (supabase as any)
    .from("users")
    .select("id, name, email, avatar_url")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function updateProfile(userId: string, values: { name: string | null; avatar_url?: string | null }) {
  const { data, error } = await (supabase as any)
    .from("users")
    .update(values)
    .eq("id", userId)
    .select("id, name, email, avatar_url")
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function uploadAvatar(userId: string, uri: string, mimeType: string | null | undefined) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = mimeType?.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, {
      contentType: mimeType ?? "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

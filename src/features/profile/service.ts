import { z } from "zod";
import { getSupabase } from "../../shared/supabase";

export const profileInput = z.object({ displayName: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100, "ชื่อยาวไม่เกิน 100 ตัวอักษร") });
export async function getProfile(userId: string) {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}
export async function updateProfile(userId: string, displayName: string) {
  const value = profileInput.parse({ displayName });
  const { error } = await getSupabase().from("profiles").update({ display_name: value.displayName }).eq("id", userId);
  if (error) throw error;
}

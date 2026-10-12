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

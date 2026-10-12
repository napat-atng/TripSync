import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/features/access/safe-next-path";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const origin = request.nextUrl.origin;

  if (!code) return NextResponse.redirect(new URL("/auth/error", origin));

  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = createRouteSupabaseClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/auth/error", origin));
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.redirect(new URL("/auth/error", origin));

  const user = userData.user;
  const rawName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const displayName = typeof rawName === "string" && rawName.trim()
    ? rawName.trim().slice(0, 120)
    : (user.email?.split("@")[0] ?? "เพื่อน").slice(0, 120);
  const { data: profile, error: profileReadError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileReadError) return NextResponse.redirect(new URL("/auth/error", origin));

  const profileResult = profile
    ? await supabase.from("profiles").update({ display_name: displayName, updated_at: new Date().toISOString() }).eq("user_id", user.id)
    : await supabase.from("profiles").insert({ user_id: user.id, display_name: displayName });
  if (profileResult.error) return NextResponse.redirect(new URL("/auth/error", origin));
  return response;
}
